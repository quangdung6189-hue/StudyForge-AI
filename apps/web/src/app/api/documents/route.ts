import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { listUserDocuments } from '@/server/dal';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '20');

    const result = await listUserDocuments(user.id, page, limit);
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
