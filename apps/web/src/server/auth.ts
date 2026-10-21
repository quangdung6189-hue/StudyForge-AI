import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@studyforge/db';
import type { UserDTO } from '@studyforge/contracts';

export const SESSION_COOKIE_NAME = 'studyforge_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT', message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes > 72) throw new AuthError('INVALID_INPUT', 'Mật khẩu vượt quá giới hạn 72 bytes của thuật toán');
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash || Buffer.byteLength(password, 'utf8') > 72) return false;
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db.session.deleteMany({ where: { tokenHash } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<UserDTO | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) {
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return null;
    }

    const { user } = session;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'student' | 'teacher' | 'admin',
    };
  } catch {
    return null;
  }
}

/** Strict guard: throws 401 if user is unauthenticated. ZERO GUEST BYPASS. */
export async function requireUser(): Promise<UserDTO> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Vui lòng đăng nhập để sử dụng tính năng này');
  }
  return user;
}

export async function requireRole(allowedRoles: Array<'student' | 'teacher' | 'admin'>): Promise<UserDTO> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('FORBIDDEN', 'Bạn không có quyền thực hiện hành động này');
  }
  return user;
}
