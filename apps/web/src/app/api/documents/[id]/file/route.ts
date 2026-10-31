import { requireUser } from '@/server/auth';
import { db } from '@studyforge/db';
import { readOriginalDocument } from '@/server/document-files';
import { uploadErrorResponse } from '@/server/upload-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const doc = await db.document.findFirst({ where: { id, ownerId: user.id } });
    if (!doc) return Response.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài liệu.' } }, { status: 404 });
    const bytes = await readOriginalDocument(user.id, doc.storageKey);
    const safeTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const mime = safeTypes.includes(doc.fileType) ? doc.fileType : 'application/octet-stream';
    let start = 0, end = bytes.length - 1;
    const range = req.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
      if (!match[1]) start = Math.max(0, bytes.length - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
    }
    // Streaming avoids the buffered response body limit for large private originals.
    let cursor = start;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      if (cursor > end) { controller.close(); return; }
      const next = Math.min(cursor + 64 * 1024, end + 1);
      controller.enqueue(new Uint8Array(bytes.subarray(cursor, next))); cursor = next;
    } });
    return new Response(stream, { status: range ? 206 : 200, headers: { 'Content-Type': mime, 'Content-Disposition': `${mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.title)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) } });
  } catch (error) {
    if ((error as { code?: string }).code === 'UNAUTHORIZED') return uploadErrorResponse(error);
    return Response.json({ error: { code: 'FILE_UNAVAILABLE', message: 'Không mở được file gốc. Bạn có thể tải lại file.' } }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
}
