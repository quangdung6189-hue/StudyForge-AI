import { requireUser } from '@/server/auth';
import { db } from '@studyforge/db';
import { readOriginalDocument } from '@/server/document-files';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const doc = await db.document.findFirst({ where: { id, ownerId: user.id } });
    if (!doc) return Response.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài liệu.' } }, { status: 404 });
    const bytes = await readOriginalDocument(user.id, doc.storageKey);
    const safeTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const mime = safeTypes.includes(doc.fileType) ? doc.fileType : 'application/octet-stream';
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': mime, 'Content-Disposition': `${mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.title)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' } });
  } catch (error) { return Response.json({ error: { code: 'FILE_UNAVAILABLE', message: 'Không mở được file gốc. Bạn có thể tải lại file.' } }, { status: (error as { code?: string }).code === 'UNAUTHORIZED' ? 401 : 404 }); }
}
