import { NextResponse } from 'next/server';
import { db, readWithRetry } from '@studyforge/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function classify(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown } | null;
  const text = typeof value?.message === 'string' ? value.message : '';
  if (value?.code === 'P2021' || value?.code === 'P2022' || /does not exist|relation .* does not exist|table .* does not exist/i.test(text)) return 'AUTH_SCHEMA_MISSING';
  if (/DATABASE_URL must be configured/i.test(text)) return 'AUTH_DATABASE_CONFIG_MISSING';
  if (/28P01|authentication failed|password authentication failed|invalid password/i.test(text)) return 'AUTH_DATABASE_CREDENTIALS_INVALID';
  return 'AUTH_DATABASE_UNAVAILABLE';
}

export async function GET() {
  try {
    await readWithRetry(() => db.$queryRaw`SELECT 1`);
    await readWithRetry(() => db.user.findFirst({ select: { id: true, email: true, name: true, role: true, passwordHash: true } }));
    await readWithRetry(() => db.session.findFirst({ select: { id: true, userId: true, tokenHash: true, expiresAt: true } }));
    return NextResponse.json({ ok: true, database: 'connected', authSchema: 'available' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[health] database check failed', { code: (error as { code?: unknown })?.code, name: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ ok: false, code: classify(error) }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}