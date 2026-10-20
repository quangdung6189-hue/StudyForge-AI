import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getOwnedDocument, updateOwnedDocument } from '@/server/dal';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const document = await getOwnedDocument(user.id, id);
    return NextResponse.json(document);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json();

    const updated = await updateOwnedDocument(user.id, id, {
      title: body.title,
      rawText: body.rawText,
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
