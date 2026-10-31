import { requireUser } from '@/server/auth';
import { DOCUMENT_PART_BYTES } from '@/lib/document-upload';
import { appendDocumentPart, cancelDocumentUpload } from '@/server/document-uploads';
import { boundedBody, uploadErrorResponse } from '@/server/upload-errors';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: Context) {
  try {
    const user = await requireUser(), { id } = await context.params;
    const position = Number(req.headers.get('x-upload-part') ?? 'invalid');
    const result = await appendDocumentPart(user.id, id, position, await boundedBody(req, DOCUMENT_PART_BYTES));
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return uploadErrorResponse(error); }
}

export async function DELETE(_req: Request, context: Context) {
  try {
    const user = await requireUser(), { id } = await context.params;
    await cancelDocumentUpload(user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) { return uploadErrorResponse(error); }
}