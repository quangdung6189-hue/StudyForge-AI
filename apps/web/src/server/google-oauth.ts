import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { db } from '@studyforge/db';

export const GOOGLE_COOKIE = 'studyforge_google_oauth';
export const GOOGLE_COOKIE_PATH = '/api/auth/google';
export const GOOGLE_AUTH_TTL_SECONDS = 10 * 60;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class GoogleAuthError extends Error {
  constructor(public readonly code: 'not_configured' | 'invalid_state' | 'cancelled' | 'invalid_identity' | 'account_exists' | 'link_failed') {
    super(code);
  }
}

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.APP_URL ?? (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  if (!clientId || !clientSecret || !appUrl) throw new GoogleAuthError('not_configured');
  let url: URL;
  try { url = new URL(appUrl); } catch { throw new GoogleAuthError('not_configured'); }
  const localHttp = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new GoogleAuthError('not_configured');
  }
  return { clientId, clientSecret, origin: url.origin, redirectUri: `${url.origin}/api/auth/google/callback` };
}

export function isGoogleAuthConfigured() {
  try { getGoogleConfig(); return true; } catch { return false; }
}

export async function startGoogleAuth(userId?: string) {
  const config = getGoogleConfig();
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const browserToken = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  await db.googleAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.googleAuthAttempt.create({ data: {
    stateHash: hash(state), browserTokenHash: hash(browserToken), nonceHash: hash(nonce),
    codeVerifier, userId, expiresAt: new Date(Date.now() + GOOGLE_AUTH_TTL_SECONDS * 1000),
  } });
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
    scope: 'openid email profile', prompt: 'select_account', state, nonce,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'), code_challenge_method: 'S256',
  }).toString();
  return { authorization, browserToken };
}

const IdentitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  email_verified: z.literal(true),
  name: z.string().optional(),
});

async function verifyGoogleIdentity(idToken: string, nonceHash: string, clientId: string) {
  try {
    const { payload } = await jwtVerify(idToken, googleKeys, {
      algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId,
      requiredClaims: ['sub', 'exp', 'iat', 'nonce', 'email', 'email_verified'], maxTokenAge: '1h', clockTolerance: 5,
    });
    if (typeof payload.nonce !== 'string' || !timingSafeEqual(Buffer.from(hash(payload.nonce)), Buffer.from(nonceHash))) {
      throw new GoogleAuthError('invalid_identity');
    }
    if ((payload.azp !== undefined && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) {
      throw new GoogleAuthError('invalid_identity');
    }
    return IdentitySchema.parse(payload);
  } catch {
    throw new GoogleAuthError('invalid_identity');
  }
}

export async function finishGoogleAuth(params: URLSearchParams, browserToken: string | undefined, currentUserId?: string) {
  const config = getGoogleConfig();
  const state = params.get('state');
  if (!state || !/^[\w-]{43}$/.test(state) || !browserToken || !/^[\w-]{43}$/.test(browserToken)) {
    throw new GoogleAuthError('invalid_state');
  }
  const where = { stateHash: hash(state), browserTokenHash: hash(browserToken), expiresAt: { gt: new Date() } };
  const attempt = await db.googleAuthAttempt.findFirst({ where });
  if (!attempt) throw new GoogleAuthError('invalid_state');
  // Atomic consumption prevents callback replay, including concurrent requests.
  const consumed = await db.googleAuthAttempt.deleteMany({ where: { ...where, id: attempt.id } });
  if (consumed.count !== 1) throw new GoogleAuthError('invalid_state');
  if (attempt.userId && attempt.userId !== currentUserId) throw new GoogleAuthError('link_failed');
  if (params.has('error')) throw new GoogleAuthError('cancelled');
  const code = params.get('code');
  if (!code || code.length > 4096) throw new GoogleAuthError('invalid_identity');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: attempt.codeVerifier,
    }),
  });
  if (!response.ok) throw new GoogleAuthError('invalid_identity');
  const tokens: unknown = await response.json();
  const parsed = z.object({ id_token: z.string().min(1).max(16384) }).safeParse(tokens);
  if (!parsed.success) throw new GoogleAuthError('invalid_identity');
  const identity = await verifyGoogleIdentity(parsed.data.id_token, attempt.nonceHash, config.clientId);
  const existing = await db.user.findUnique({ where: { googleSubject: identity.sub } });

  if (attempt.userId) {
    // Linking needs the original authenticated session AND the matching verified email.
    // Never attach an identity to an existing account based on email alone.
    if (existing && existing.id !== attempt.userId) throw new GoogleAuthError('link_failed');
    const linked = await db.user.updateMany({ where: {
      id: attempt.userId, email: identity.email,
      OR: [{ googleSubject: null }, { googleSubject: identity.sub }],
    }, data: { googleSubject: identity.sub, emailVerifiedAt: new Date() } });
    if (linked.count !== 1) throw new GoogleAuthError('link_failed');
    return { userId: attempt.userId, linked: true };
  }
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
    return { userId: existing.id, linked: false };
  }
  if (await db.user.findUnique({ where: { email: identity.email } })) throw new GoogleAuthError('account_exists');
  try {
    const user = await db.user.create({ data: {
      email: identity.email, name: identity.name?.trim().slice(0, 100) || identity.email.split('@')[0],
      googleSubject: identity.sub, passwordHash: null, role: 'student', emailVerifiedAt: new Date(), lastLoginAt: new Date(),
    } });
    return { userId: user.id, linked: false };
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    // Another valid callback may have created the same Google account concurrently.
    const user = await db.user.findUnique({ where: { googleSubject: identity.sub } });
    if (!user) throw new GoogleAuthError('account_exists');
    return { userId: user.id, linked: false };
  }
}
