import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { LoginSchema } from '@studyforge/contracts';
import { verifyPassword, createSession, setSessionCookie } from '@/server/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email hoặc mật khẩu không hợp lệ' } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

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
