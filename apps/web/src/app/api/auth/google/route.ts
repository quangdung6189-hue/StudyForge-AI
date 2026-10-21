import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth';
import { GOOGLE_AUTH_TTL_SECONDS, GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, GoogleAuthError, getGoogleConfig, startGoogleAuth } from '@/server/google-oauth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const config = getGoogleConfig();
    if (request.nextUrl.origin !== config.origin) throw new GoogleAuthError('not_configured');
    const link = request.nextUrl.searchParams.get('intent') === 'link';
    const user = link ? await getSessionUser() : null;
    if (link && !user) {
      return NextResponse.redirect(new URL('/sign-in?google_error=link_failed', config.origin), 303);
    }
    const { authorization, browserToken } = await startGoogleAuth(user?.id);
    const response = NextResponse.redirect(authorization, 303);
    response.cookies.set(GOOGLE_COOKIE, browserToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: GOOGLE_COOKIE_PATH, maxAge: GOOGLE_AUTH_TTL_SECONDS,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const code = error instanceof GoogleAuthError ? error.code : 'failed';
    return NextResponse.redirect(new URL(`/sign-in?google_error=${code}`, request.url), 303);
  }
}
