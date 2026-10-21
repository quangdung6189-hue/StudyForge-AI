import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionUser, setSessionCookie } from '@/server/auth';
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, GoogleAuthError, finishGoogleAuth, getGoogleConfig } from '@/server/google-oauth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let destination = new URL('/sign-in?google_error=failed', request.url);
  try {
    const config = getGoogleConfig();
    destination = new URL('/sign-in?google_error=failed', config.origin);
    if (request.nextUrl.origin !== config.origin) throw new GoogleAuthError('invalid_state');
    const currentUser = await getSessionUser();
    const result = await finishGoogleAuth(request.nextUrl.searchParams, request.cookies.get(GOOGLE_COOKIE)?.value, currentUser?.id);
    if (!result.linked) {
      const session = await createSession(result.userId);
      await setSessionCookie(session.token, session.expiresAt);
    }
    destination = new URL('/dashboard', config.origin);
  } catch (error) {
    const code = error instanceof GoogleAuthError ? error.code : 'failed';
    destination.searchParams.set('google_error', code);
  }
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(GOOGLE_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: GOOGLE_COOKIE_PATH, maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
