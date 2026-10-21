import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPair, exportJWK, SignJWT, type JWTPayload } from 'jose';
import { NextRequest } from 'next/server';

// Use a separate database. The existing application database is never reset.
const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/google-auth-test-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`;
  process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  process.env.STUDYFORGE_ROOT = process.cwd();
  process.env.APP_URL = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-client-secret';
  const cookies = new Map<string, string>();
  const options = new Map<string, Record<string, unknown>>();
  return { databaseFile, cookies, options };
});

vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => fixture.cookies.has(name) ? { value: fixture.cookies.get(name)! } : undefined,
  set: (name: string, value: string, options: Record<string, unknown>) => { fixture.cookies.set(name, value); fixture.options.set(name, options); },
  delete: (name: string) => fixture.cookies.delete(name),
}) }));

import { db } from '@studyforge/db';
import { createSession, hashPassword, verifyPassword, getSessionUser, clearSessionCookie } from '../apps/web/src/server/auth';
import { finishGoogleAuth, getGoogleConfig, startGoogleAuth, GOOGLE_COOKIE } from '../apps/web/src/server/google-oauth';
import { POST as login } from '../apps/web/src/app/api/auth/login/route';
import { POST as register } from '../apps/web/src/app/api/auth/register/route';
import { GET as googleStart } from '../apps/web/src/app/api/auth/google/route';
import { GET as googleCallback } from '../apps/web/src/app/api/auth/google/callback/route';

let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
let idToken = '';
const fetchMock = vi.fn<typeof fetch>();
const jsonRequest = (url: string, body: unknown) => new Request(`http://localhost:3000${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeAll(async () => {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], {
    env: process.env, encoding: 'utf8', timeout: 30000,
  });
  if (result.status !== 0) throw new Error(`Test database initialization failed: ${result.stderr || result.stdout}`);
  keyPair = await generateKeyPair('RS256', { extractable: true });
  jwk = { ...await exportJWK(keyPair.publicKey), kid: 'test-google-key', alg: 'RS256', use: 'sig' };
});

beforeEach(() => {
  fixture.cookies.clear();
  fixture.options.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ id_token: idToken });
    throw new Error('Unexpected network request in authentication test');
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.$disconnect();
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(fixture.databaseFile + suffix, { force: true });
});

async function prepare(subject: string, email: string, overrides: JWTPayload = {}, linkUserId?: string) {
  const start = await startGoogleAuth(linkUserId);
  const params = start.authorization.searchParams;
  const claims = {
    sub: subject, email, email_verified: true, name: 'Google Student', nonce: params.get('nonce'),
    iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  idToken = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-google-key' }).sign(keyPair.privateKey);
  return { ...start, callback: new URLSearchParams({ state: params.get('state')!, code: 'test-authorization-code' }) };
}

describe('Password registration and database sessions', () => {
  it('persists only a password hash and supports login, session lookup and logout', async () => {
    const password = 'SecurePassword2026!';
    const response = await register(jsonRequest('/api/auth/register', { email: 'LOCAL@example.com', password, name: 'Local Student', role: 'student' }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    const user = await db.user.findUniqueOrThrow({ where: { id: payload.user.id } });
    expect(user.email).toBe('local@example.com');
    expect(user.passwordHash).not.toBe(password);
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.googleSubject).toBeNull();
    expect(payload.user.passwordHash).toBeUndefined();
    expect(fixture.options.get('studyforge_session')).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    const rawSession = fixture.cookies.get('studyforge_session');
    expect((await db.session.findFirstOrThrow({ where: { userId: user.id } })).tokenHash).not.toBe(rawSession);
    expect((await getSessionUser())?.id).toBe(user.id);
    const bad = await login(jsonRequest('/api/auth/login', { email: user.email, password: 'wrong' }));
    expect(bad.status).toBe(401);
    const good = await login(jsonRequest('/api/auth/login', { email: user.email, password }));
    expect(good.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).not.toBeNull();
    await clearSessionCookie();
    expect(await getSessionUser()).toBeNull();
  });

  it('rejects passwords exceeding bcrypt byte limits and has no password fallback for Google accounts', async () => {
    expect(await verifyPassword('any-password', null)).toBe(false);
    const hash = await hashPassword('a'.repeat(72));
    expect(await verifyPassword('a'.repeat(72) + 'suffix', hash)).toBe(false);
    await expect(hashPassword('é'.repeat(40))).rejects.toThrow();
  });
});

describe('Verified Google OAuth and persistent identity', () => {
  it('creates a student, stores the stable subject without a password, and reuses the same account', async () => {
    const first = await prepare('google-student-1', 'google-student@example.com');
    expect(first.authorization.origin).toBe('https://accounts.google.com');
    expect(first.authorization.searchParams.get('code_challenge_method')).toBe('S256');
    expect(first.authorization.searchParams.get('scope')).toBe('openid email profile');
    const result = await finishGoogleAuth(first.callback, first.browserToken);
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user).toMatchObject({ role: 'student', googleSubject: 'google-student-1', passwordHash: null });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.lastLoginAt).not.toBeNull();
    const exchange = fetchMock.mock.calls.find(([url]) => String(url) === 'https://oauth2.googleapis.com/token');
    expect((exchange?.[1]?.body as URLSearchParams).get('code_verifier')).toHaveLength(43);
    const second = await prepare('google-student-1', 'changed-email@example.com');
    expect((await finishGoogleAuth(second.callback, second.browserToken)).userId).toBe(user.id);
    const passwordAttempt = await login(jsonRequest('/api/auth/login', { email: user.email, password: 'invented-password' }));
    expect(passwordAttempt.status).toBe(401);
  });

  it('rejects missing or wrong browser state, expired state, and callback replay', async () => {
    const start = await prepare('state-test', 'state@example.com');
    await expect(finishGoogleAuth(start.callback, undefined)).rejects.toMatchObject({ code: 'invalid_state' });
    await expect(finishGoogleAuth(start.callback, 'x'.repeat(43))).rejects.toMatchObject({ code: 'invalid_state' });
    const wrongState = new URLSearchParams(start.callback); wrongState.set('state', 'x'.repeat(43));
    await expect(finishGoogleAuth(wrongState, start.browserToken)).rejects.toMatchObject({ code: 'invalid_state' });
    expect(fetchMock).not.toHaveBeenCalled();
    await finishGoogleAuth(start.callback, start.browserToken);
    await expect(finishGoogleAuth(start.callback, start.browserToken)).rejects.toMatchObject({ code: 'invalid_state' });
    const expired = await prepare('expired-state', 'expired-state@example.com');
    await db.googleAuthAttempt.updateMany({ data: { expiresAt: new Date(0) } });
    await expect(finishGoogleAuth(expired.callback, expired.browserToken)).rejects.toMatchObject({ code: 'invalid_state' });
  });

  it.each([
    ['audience', { aud: 'another-app' }],
    ['issuer', { iss: 'https://attacker.example.com' }],
    ['expiry', { exp: 1 }],
    ['nonce', { nonce: 'wrong-nonce' }],
    ['verified email', { email_verified: false }],
    ['authorized presenter', { azp: 'another-app' }],
  ])('rejects an invalid %s without creating an account', async (label, overrides) => {
    const start = await prepare(`invalid-${label}`, `invalid-${label.replaceAll(' ', '-')}@example.com`, overrides);
    const usersBefore = await db.user.count();
    await expect(finishGoogleAuth(start.callback, start.browserToken)).rejects.toMatchObject({ code: 'invalid_identity' });
    expect(await db.user.count()).toBe(usersBefore);
  });

  it('rejects a forged signature', async () => {
    const start = await prepare('forged', 'forged@example.com');
    const parts = idToken.split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    idToken = parts.join('.');
    await expect(finishGoogleAuth(start.callback, start.browserToken)).rejects.toMatchObject({ code: 'invalid_identity' });
  });

  it('requires an authenticated matching account to link an existing email and preserves its role and password', async () => {
    const passwordHash = await hashPassword('TeacherPassword2026!');
    const local = await db.user.create({ data: { email: 'existing-teacher@example.com', name: 'Teacher', role: 'teacher', passwordHash } });
    const attemptedTakeover = await prepare('google-teacher', local.email);
    await expect(finishGoogleAuth(attemptedTakeover.callback, attemptedTakeover.browserToken)).rejects.toMatchObject({ code: 'account_exists' });
    const missingSession = await prepare('google-teacher', local.email, {}, local.id);
    await expect(finishGoogleAuth(missingSession.callback, missingSession.browserToken)).rejects.toMatchObject({ code: 'link_failed' });
    const wrongEmail = await prepare('google-teacher', 'different@example.com', {}, local.id);
    await expect(finishGoogleAuth(wrongEmail.callback, wrongEmail.browserToken, local.id)).rejects.toMatchObject({ code: 'link_failed' });
    const link = await prepare('google-teacher', local.email, {}, local.id);
    expect(await finishGoogleAuth(link.callback, link.browserToken, local.id)).toEqual({ userId: local.id, linked: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: local.id } })).toMatchObject({ googleSubject: 'google-teacher', role: 'teacher', passwordHash });
  });

  it('creates a real application session in the callback route and clears the temporary cookie', async () => {
    const start = await prepare('callback-route', 'callback-route@example.com');
    const response = await googleCallback(new NextRequest(`http://localhost:3000/api/auth/google/callback?${start.callback}`, {
      headers: { cookie: `${GOOGLE_COOKIE}=${start.browserToken}` },
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.cookies.get(GOOGLE_COOKIE)?.value).toBe('');
    expect(await getSessionUser()).toMatchObject({ email: 'callback-route@example.com', role: 'student' });
  });

  it('handles cancellation without creating a user or session', async () => {
    const start = await prepare('cancelled', 'cancelled@example.com');
    start.callback.set('error', 'access_denied');
    const before = await db.user.count();
    const response = await googleCallback(new NextRequest(`http://localhost:3000/api/auth/google/callback?${start.callback}`, {
      headers: { cookie: `${GOOGLE_COOKIE}=${start.browserToken}` },
    }));
    expect(response.headers.get('location')).toBe('http://localhost:3000/sign-in?google_error=cancelled');
    expect(await db.user.count()).toBe(before);
    expect(await getSessionUser()).toBeNull();
  });

  it('sets an HttpOnly temporary cookie and rejects unauthenticated account linking', async () => {
    const response = await googleStart(new NextRequest('http://localhost:3000/api/auth/google'));
    expect(response.status).toBe(303);
    expect(response.cookies.get(GOOGLE_COOKIE)).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/api/auth/google' });
    const blocked = await googleStart(new NextRequest('http://localhost:3000/api/auth/google?intent=link'));
    expect(blocked.headers.get('location')).toBe('http://localhost:3000/sign-in?google_error=link_failed');
  });

  it('fails closed when Google credentials or a secure production origin are missing', () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const origin = process.env.APP_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => getGoogleConfig()).toThrow('not_configured');
    process.env.GOOGLE_CLIENT_ID = clientId;
    process.env.APP_URL = 'http://public.example.com';
    expect(() => getGoogleConfig()).toThrow('not_configured');
    process.env.APP_URL = origin;
  });
});
