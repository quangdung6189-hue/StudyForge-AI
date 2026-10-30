import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { LoginSchema } from '@studyforge/contracts';
import { verifyPassword, createSession, setSessionCookie } from '@/server/auth';
import { createHash } from 'node:crypto';

const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginBucketId(ip: string, email: string): string {
  return createHash('sha256').update(`login:${ip}:${email.toLowerCase()}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email hoặc mật khẩu không hợp lệ' } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Rate limiting: best-effort, không chặn đăng nhập nếu bảng chưa sẵn sàng
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

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không chính xác' } },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không chính xác' } },
        { status: 401 }
      );
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await createSession(user.id);
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
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Không thể đăng nhập lúc này. Vui lòng thử lại.' } },
      { status: 500 }
    );
  }
}
