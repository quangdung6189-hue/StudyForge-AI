import { requireUser } from '@/server/auth';
import { startDocumentUpload } from '@/server/document-uploads';
import { boundedBody, UploadError, uploadErrorResponse } from '@/server/upload-errors';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let input: unknown;
    try { input = JSON.parse((await boundedBody(req, 4096)).toString('utf8')); }
    catch (error) { if (error instanceof UploadError) throw error; throw new UploadError('INVALID_INPUT', 'Thông tin file chưa hợp lệ.'); }
    return Response.json(await startDocumentUpload(user.id, input), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return uploadErrorResponse(error); }
}