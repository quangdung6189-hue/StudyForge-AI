import { requireUser } from '@/server/auth';
import { completeDocumentUpload } from '@/server/document-uploads';
import { uploadErrorResponse } from '@/server/upload-errors';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), { id } = await context.params;
    const document = await completeDocumentUpload(user.id, id, req.signal);
    return Response.json({ success: true, documents: [document] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return uploadErrorResponse(error); }
}