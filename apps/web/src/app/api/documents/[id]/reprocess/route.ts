import { z } from 'zod';
import { db } from '@studyforge/db';
import { requireUser } from '@/server/auth';
import { updateOwnedDocument } from '@/server/dal';
import { readOriginalDocument, saveExtractionMetadata } from '@/server/document-files';
import { extractDocumentContent } from '@/server/extractor';
import { readWithDocling } from '@/server/docling';
export const maxDuration = 300;

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  let previous: { id: string; status: string; revision: number } | undefined;
  try {
    const user = await requireUser(), { id } = await context.params;
    const input = z.strictObject({ vision: z.boolean().default(false), engine: z.enum(['native','docling']).default('native') }).safeParse(await req.json());
    if (!input.success) return Response.json({ error: { code: 'INVALID_INPUT', message: 'Chế độ đọc chưa hợp lệ.' } }, { status: 400 });
    const doc = await db.document.findFirst({ where: { id, ownerId: user.id } });
    if (!doc) return Response.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài liệu.' } }, { status: 404 });
    const lock = await db.document.updateMany({ where: { id, ownerId: user.id, OR: [{ status: { not: 'extracting' } }, { updatedAt: { lt: new Date(Date.now() - 600_000) } }] }, data: { status: 'extracting' } });
    if (!lock.count) return Response.json({ error: { code: 'BUSY', message: 'Tài liệu đang được đọc. Hãy chờ hoàn tất.' } }, { status: 409 });
    previous = { id, status: doc.status === 'extracting' ? 'needs_ocr' : doc.status, revision: doc.revision };
    const bytes = await readOriginalDocument(user.id, doc.storageKey);
    const extension = doc.fileType.includes('pdf') ? '.pdf' : doc.fileType.includes('wordprocessingml') ? '.docx' : doc.fileType.includes('png') ? '.png' : doc.fileType.includes('jpeg') ? '.jpg' : '.txt';
    const extraction = input.data.engine === 'docling' ? await readWithDocling(bytes, doc.title + extension, req.signal) : await extractDocumentContent(bytes, doc.fileType, doc.title + extension, { ocr: true, forceVision: input.data.vision, signal: req.signal });
    if (extraction.needsOcr && doc.rawText?.trim()) {
      await db.document.updateMany({ where: { id, revision: doc.revision, status: 'extracting' }, data: { status: previous.status } }); previous = undefined;
      return Response.json({ applied: false, candidateText: extraction.rawText, warnings: ['Bản đọc mới còn chỗ chưa chắc chắn; chưa thay thế văn bản đã lưu.', ...extraction.warnings] });
    }
    const updated = await updateOwnedDocument(user.id, id, { rawText: extraction.rawText }, doc.revision);
    await db.document.update({ where: { id }, data: { status: extraction.needsOcr ? 'needs_ocr' : 'ready' } }); previous = undefined;
    await saveExtractionMetadata(id, updated.revision, extraction).catch(() => {});
    return Response.json({ applied: true, warnings: extraction.warnings });
  } catch (error) {
    if (previous) await db.document.updateMany({ where: { id: previous.id, revision: previous.revision, status: 'extracting' }, data: { status: previous.status } }).catch(() => {});
    return Response.json({ error: { code: 'READ_FAILED', message: (error as { code?: string }).code === 'UNAUTHORIZED' ? 'Bạn cần đăng nhập.' : 'Chưa đọc lại được file. Văn bản đã lưu được giữ nguyên; hãy thử lại hoặc tải lại file.' } }, { status: (error as { code?: string }).code === 'UNAUTHORIZED' ? 401 : 502 });
  }
}
