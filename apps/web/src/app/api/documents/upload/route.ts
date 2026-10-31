import { requireUser } from '@/server/auth';
import { DOCUMENT_MAX_FILES, DOCUMENT_PART_BYTES } from '@/lib/document-upload';
import { startDocumentUpload, appendDocumentPart, completeDocumentUpload, cancelDocumentUpload } from '@/server/document-uploads';
import { UploadError, uploadErrorResponse } from '@/server/upload-errors';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Compatibility endpoint; the browser uses /uploads with 1MB requests. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (process.env.VERCEL && Number(req.headers.get('content-length')) > 4 * 1024 * 1024) throw new UploadError('FILE_TOO_LARGE', 'File lớn cần dùng luồng tải chia phần. Hãy tải lại trang.', 413);
    const form = await req.formData();
    const files = form.getAll('files');
    if (!files.length || files.length > DOCUMENT_MAX_FILES || files.some(file => !(file instanceof File))) throw new UploadError('INVALID_INPUT', 'Chọn từ 1 đến 10 file tài liệu hợp lệ.');
    const documents = [];
    for (const entry of files) {
      const file = entry as File;
      const { uploadId } = await startDocumentUpload(user.id, { filename: file.name, size: file.size });
      try {
        for (let offset = 0, position = 0; offset < file.size; offset += DOCUMENT_PART_BYTES, position++) {
          await appendDocumentPart(user.id, uploadId, position, Buffer.from(await file.slice(offset, offset + DOCUMENT_PART_BYTES).arrayBuffer()));
        }
        documents.push(await completeDocumentUpload(user.id, uploadId, req.signal));
      } catch (error) { await cancelDocumentUpload(user.id, uploadId).catch(() => {}); throw error; }
    }
    return Response.json({ success: true, documents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return uploadErrorResponse(error); }
}
