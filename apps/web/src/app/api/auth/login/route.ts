import { NextResponse } from 'next/server';
import { db, readWithRetry } from '@studyforge/db';
import { LoginSchema } from '@studyforge/contracts';
import { verifyPassword, createSession, setSessionCookie } from '@/server/auth';
import { createHash } from 'node:crypto';

const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as { code?: unknown; message?: unknown; name?: unknown };
  if (typeof value.code === 'string' && /^P\d{4}$/.test(value.code)) return value.code;
  if (value.name === 'PrismaClientInitializationError' && typeof value.message === 'string') {
    if (value.message.includes('DATABASE_URL must be configured')) return 'DATABASE_CONFIG_MISSING';
    if (/Can't reach database server|connection timed out|Server has closed the connection/i.test(value.message)) return 'DATABASE_UNAVAILABLE';
  }
  return null;
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
    const user = await readWithRetry(() => db.user.findUnique({ where: { email } }));
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
    const response = code === 'P2021' || code === 'P2022'
      ? { code: 'AUTH_SCHEMA_MISSING', message: 'Cơ sở dữ liệu production thiếu bảng đăng nhập. Hãy chạy migration auth.' }
      : code === 'DATABASE_CONFIG_MISSING'
        ? { code: 'AUTH_DATABASE_CONFIG_MISSING', message: 'Website production chưa cấu hình DATABASE_URL.' }
        : code === 'DATABASE_UNAVAILABLE' || code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017'
          ? { code: 'AUTH_DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu production chưa sẵn sàng. Hãy kiểm tra DATABASE_URL.' }
          : { code: 'AUTH_LOGIN_FAILED', message: `Đăng nhập lỗi tại bước ${phase}. Kiểm tra log server.` };
    return NextResponse.json(
      { error: response },
      { status: code === 'P2021' || code === 'P2022' || code === 'DATABASE_CONFIG_MISSING' ? 503 : 500 }
    );
  }
}
