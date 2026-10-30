import { NextResponse } from 'next/server';
import { db, readWithRetry } from '@studyforge/db';
import { LoginSchema } from '@studyforge/contracts';
import { verifyPassword, createSession, setSessionCookie } from '@/server/auth';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const value = error as { message?: unknown; cause?: unknown; sourceError?: unknown };
  return [value.message, errorText(value.cause), errorText(value.sourceError)]
    .filter(value => typeof value === 'string' && value.length > 0)
    .join(' | ');
}
const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function databaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'DATABASE_QUERY_FAILED';
  const value = error as { code?: unknown; name?: unknown };
  if (typeof value.code === 'string' && /^P\d{4}$/.test(value.code)) return value.code;
  const text = errorText(error);
  if (text.includes('DATABASE_URL must be configured')) return 'DATABASE_CONFIG_MISSING';
  if (/P2021|P2022|does not exist|relation .* does not exist|table .* does not exist/i.test(text)) return 'AUTH_SCHEMA_MISSING';
  if (/28P01|authentication failed|password authentication failed|invalid password/i.test(text)) return 'DATABASE_AUTH_FAILED';
  if (value.name === 'PrismaClientInitializationError' || /Can't reach database server|connection timed out|Server has closed the connection|getaddrinfo|ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|websocket|socket/i.test(text)) return 'DATABASE_UNAVAILABLE';
  return 'DATABASE_QUERY_FAILED';
}

function loginBucketId(ip: string, email: string): string {
  return createHash('sha256').update(`login:${ip}:${email.toLowerCase()}`).digest('hex');
}

export async function POST(req: Request) {
  let phase = 'request';
  try {
    phase = 'parse_input';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email hoặc mật khẩu không hợp lệ' } },
        { status: 400 }
      );
    }

    // Email input often contains accidental spaces or uppercase characters.
    // User emails are stored normalized by registration, so normalize here too.
    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    // Rate limiting: best-effort, không chặn đăng nhập nếu bảng chưa sẵn sàng
    phase = 'rate_limit';
    let rateLimited = false;
    let retryAfter = 0;
    try {
      const id = loginBucketId(ip, email);
      const windowStart = Math.floor(Date.now() / LOGIN_WINDOW_MS);
      const bucketId = createHash('sha256').update(`${id}:${windowStart}`).digest('hex');
      const expiresAt = new Date((windowStart + 1) * LOGIN_WINDOW_MS);

      const bucket = await db.rateLimitBucket.upsert({
        where: { id: bucketId },
        create: { id: bucketId, count: 1, expiresAt },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > LOGIN_RATE_LIMIT) {
        rateLimited = true;
        retryAfter = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
      }
    } catch {
      // Bỏ qua lỗi rate limiting (ví dụ bảng chưa migrate), vẫn cho phép đăng nhập
    }

    if (rateLimited) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần đăng nhập thất bại. Hãy thử lại sau 15 phút.' } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    phase = 'find_user';
    const user = await readWithRetry(() => db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    }));
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không chính xác' } },
        { status: 401 }
      );
    }

    phase = 'verify_password';
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không chính xác' } },
        { status: 401 }
      );
    }

    // Login must not fail because an optional audit timestamp hits a stale DB connection.
    // Session creation remains mandatory and still fails closed if DB is unavailable.
    phase = 'write_login_audit';
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch((error) => {
      console.error('[auth/login] lastLoginAt update failed', {
        code: databaseErrorCode(error),
        name: error instanceof Error ? error.name : typeof error,
      });
    });
    phase = 'create_session';
    const session = await createSession(user.id);
    phase = 'set_cookie';
    await setSessionCookie(session.token, session.expiresAt);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    const code = databaseErrorCode(error);
    console.error('[auth/login] request failed', {
      phase,
      code,
      name: error instanceof Error ? error.name : typeof error,
    });
    const response = code === 'P2021' || code === 'P2022' || code === 'AUTH_SCHEMA_MISSING'
      ? { code: 'AUTH_SCHEMA_MISSING', message: 'Cơ sở dữ liệu production thiếu bảng đăng nhập. Hãy chạy migration auth.' }
      : code === 'DATABASE_CONFIG_MISSING'
        ? { code: 'AUTH_DATABASE_CONFIG_MISSING', message: 'Website production chưa cấu hình DATABASE_URL.' }
        : code === 'DATABASE_AUTH_FAILED'
          ? { code: 'AUTH_DATABASE_CREDENTIALS_INVALID', message: 'DATABASE_URL production bị từ chối. Kiểm tra username, password và quyền database.' }
        : code === 'DATABASE_UNAVAILABLE' || code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017'
          ? { code: 'AUTH_DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu production chưa sẵn sàng. Hãy kiểm tra DATABASE_URL.' }
          : { code: 'AUTH_DATABASE_QUERY_FAILED', message: `Không đọc được cơ sở dữ liệu tại bước ${phase}. Mở /api/health để kiểm tra production.` };
    return NextResponse.json(
      { error: response },
      { status: code === 'P2021' || code === 'P2022' || code === 'AUTH_SCHEMA_MISSING' || code === 'DATABASE_CONFIG_MISSING' ? 503 : 500 }
    );
  }
}
