import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { RegisterSchema } from '@studyforge/contracts';
import { hashPassword, createSession, setSessionCookie } from '@/server/auth';
import { createHash } from 'node:crypto';

const REGISTER_RATE_LIMIT = 3;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

function registerBucketId(ip: string, email: string): string {
  return createHash('sha256').update(`register:${ip}:${email.toLowerCase()}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' } },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;
    const id = registerBucketId(ip, email);
    const windowStart = Math.floor(Date.now() / REGISTER_WINDOW_MS);
    const bucketId = createHash('sha256').update(`${id}:${windowStart}`).digest('hex');
    const expiresAt = new Date((windowStart + 1) * REGISTER_WINDOW_MS);

    const bucket = await db.rateLimitBucket.upsert({
      where: { id: bucketId },
      create: { id: bucketId, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > REGISTER_RATE_LIMIT) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần đăng ký. Hãy thử lại sau 15 phút.' } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((expiresAt.getTime() - Date.now()) / 1000)) } }
      );
    }

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
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: { code: 'EMAIL_EXISTS', message: 'Email này đã được đăng ký tài khoản' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.' } },
      { status: 500 }
    );
  }
}
