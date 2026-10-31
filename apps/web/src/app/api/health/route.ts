import { NextResponse } from 'next/server';
import { db, readWithRetry } from '@studyforge/db';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function targetFingerprint(): string | null {
  const value = process.env.DATABASE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    // Stable identifier for comparing deployments; never reveal host, username or password.
    return createHash('sha256').update(`${url.hostname.toLowerCase()}:${url.port || '5432'}/${url.pathname.replace(/^\//, '')}?schema=${url.searchParams.get('schema') || 'public'}`).digest('hex').slice(0, 12);
  } catch { return null; }
}

function classify(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown } | null;
  const text = typeof value?.message === 'string' ? value.message : '';
  if (/query engine|query_engine|libquery_engine|could not locate|could not.*load.*engine/i.test(text)) return 'AUTH_DATABASE_ENGINE_MISSING';
  if (value?.code === 'P2021' || value?.code === 'P2022' || /does not exist|relation .* does not exist|table .* does not exist/i.test(text)) return 'AUTH_SCHEMA_MISSING';
  if (/DATABASE_URL must be configured/i.test(text)) return 'AUTH_DATABASE_CONFIG_MISSING';
  if (/28P01|authentication failed|password authentication failed|invalid password/i.test(text)) return 'AUTH_DATABASE_CREDENTIALS_INVALID';
  return 'AUTH_DATABASE_UNAVAILABLE';
}

export async function GET() {
  let phase: 'database' | 'auth' | 'uploads' = 'database';
  try {
    await readWithRetry(() => db.$queryRaw`SELECT 1`);
    phase = 'auth';
    await readWithRetry(() => db.user.findFirst({ select: { id: true, email: true, name: true, role: true, passwordHash: true } }));
    await readWithRetry(() => db.session.findFirst({ select: { id: true, userId: true, tokenHash: true, expiresAt: true } }));
    phase = 'uploads';
    await readWithRetry(() => db.documentFile.findFirst({ select: { documentId: true } }));
    await readWithRetry(() => db.documentUpload.findFirst({ select: { id: true } }));
    await readWithRetry(() => db.documentUploadPart.findFirst({ select: { uploadId: true, position: true } }));
    return NextResponse.json({ ok: true, database: 'connected', authSchema: 'available', uploadSchema: 'available', documentStorage: 'database', target: targetFingerprint() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const internalCode = (error as { code?: string })?.code;
    const code = phase === 'uploads' && ['P2021', 'P2022'].includes(internalCode ?? '') ? 'UPLOAD_SCHEMA_MISSING' : classify(error);
    console.error('[health] database check failed', { phase, code, internalCode: /^P\d{4}$/.test(internalCode ?? '') ? internalCode : undefined });
    return NextResponse.json({
      ok: false,
      code,
      target: targetFingerprint(),
      message: code === 'UPLOAD_SCHEMA_MISSING' ? 'Database đã kết nối nhưng chưa có bảng upload. Quản trị viên cần chạy npm run db:migrate.' : 'Kiểm tra cấu hình database hoặc schema trong Runtime Logs.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
