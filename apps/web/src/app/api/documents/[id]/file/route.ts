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
    const bytes = await readOriginalDocument(user.id, doc.storageKey, id);
    const url = new URL(req.url);
    const isDownload = url.searchParams.get('download') === '1';
    const safeTypes = [
      'application/pdf',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const mime = safeTypes.includes(doc.fileType) ? doc.fileType : 'application/octet-stream';
    let filename = doc.title;
    if (doc.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && !filename.toLowerCase().endsWith('.docx')) {
      filename += '.docx';
    } else if (doc.fileType === 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }
    const disposition = isDownload || mime === 'application/octet-stream' ? 'attachment' : 'inline';
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
    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}),
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'UNAUTHORIZED') return uploadErrorResponse(error);
    const msg = (error as Error)?.message || 'Không mở được file gốc. Bạn có thể tải lại file.';
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:36px;font-family:system-ui,-apple-system,sans-serif;background:#090D16;color:#e2e8f0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;}h3{color:#f87171;margin-bottom:8px;font-size:18px;}p{color:#94a3b8;font-size:13.5px;max-width:480px;line-height:1.6;margin:0 0 16px;}.btn{display:inline-block;padding:8px 16px;background:#4F46E5;color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;}</style></head><body><h3>Không thể hiển thị trực tiếp file gốc</h3><p>${msg}<br/>Văn bản bóc tách và toàn bộ câu hỏi vẫn được bảo toàn đầy đủ.</p><a href="javascript:location.reload()" class="btn">Thử tải lại</a></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store' } }
    );
  }
}
