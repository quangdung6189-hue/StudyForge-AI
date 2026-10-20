import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { RegisterSchema } from '@studyforge/contracts';
import { hashPassword, createSession, setSessionCookie } from '@/server/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' } },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;

    // Check existing email
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'EMAIL_EXISTS', message: 'Email này đã được đăng ký tài khoản' } },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        emailVerifiedAt: new Date(), // Auto-verified for local development & immediate onboarding
      },
    });

    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return NextResponse.json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
