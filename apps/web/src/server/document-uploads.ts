import { createHash } from 'node:crypto';
import { db, transaction } from '@studyforge/db';
import { z } from 'zod';
import { DOCUMENT_MAX_BYTES, DOCUMENT_PART_BYTES, documentFileType } from '@/lib/document-upload';
import { extractDocumentContent } from './extractor';
import { analyzeDocument } from './question-sections';
import { UploadError } from './upload-errors';

const Input = z.strictObject({ filename: z.string().trim().min(1).max(255), size: z.number().int().min(1).max(DOCUMENT_MAX_BYTES) });
const ttl = 60 * 60 * 1000;
export const validUploadId = (id: string) => z.uuid().safeParse(id).success;

export async function startDocumentUpload(ownerId: string, input: unknown) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) throw new UploadError('INVALID_INPUT', 'Tên file hoặc dung lượng chưa hợp lệ; tối đa 25MB/file.');
  const { filename, size } = parsed.data;
  const fileType = documentFileType(filename);
  if (!fileType) throw new UploadError('INVALID_FILE_TYPE', 'Chỉ nhận PDF, DOCX, TXT, PNG và JPG.');
  return transaction(async tx => {
    const now = new Date();
    // Expired parts have no document attached; reclaim abandoned bytes across accounts.
    await tx.documentUpload.deleteMany({ where: { expiresAt: { lte: now } } });
    const window = Math.floor(now.getTime() / 900000);
    const bucket = await tx.rateLimitBucket.upsert({ where: { id: `upload:${ownerId}:${window}` }, create: { id: `upload:${ownerId}:${window}`, expiresAt: new Date((window + 1) * 900000) }, update: { count: { increment: 1 } } });
    const limit = Math.min(100, Math.max(1, Number(process.env.UPLOAD_RATE_LIMIT_PER_15_MIN) || 20));
    if (bucket.count > limit || await tx.documentUpload.count({ where: { ownerId, status: { not: 'completed' } } }) >= 10) {
      throw new UploadError('RATE_LIMITED', 'Bạn đang tải quá nhiều tài liệu. Hãy chờ hoặc hoàn tất lần tải hiện tại.', 429);
    }
    const upload = await tx.documentUpload.create({ data: { ownerId, filename, size, fileType, expiresAt: new Date(now.getTime() + ttl) } });
    return { uploadId: upload.id, partBytes: DOCUMENT_PART_BYTES };
  });
}

export async function appendDocumentPart(ownerId: string, id: string, position: number, content: Buffer) {
  if (!validUploadId(id) || !Number.isSafeInteger(position) || position < 0 || position >= Math.ceil(DOCUMENT_MAX_BYTES / DOCUMENT_PART_BYTES)) throw new UploadError('INVALID_INPUT', 'Mã tải lên hoặc thứ tự phần chưa hợp lệ.');
  if (!content.length || content.length > DOCUMENT_PART_BYTES) throw new UploadError('FILE_TOO_LARGE', 'Mỗi phần phải có dung lượng từ 1 byte đến 1MB.', 413);
  const checksum = createHash('sha256').update(content).digest('hex');
  return transaction(async tx => {
    const upload = await tx.documentUpload.findFirst({ where: { id, ownerId, expiresAt: { gt: new Date() } } });
    if (!upload) throw new UploadError('NOT_FOUND', 'Lần tải không tồn tại, đã hết hạn hoặc không thuộc tài khoản của bạn.', 404);
    if (upload.status !== 'uploading') throw new UploadError('UPLOAD_BUSY', 'Tài liệu đang được xử lý hoặc đã hoàn tất.', 409);
    if (position < upload.nextPart) {
      const previous = await tx.documentUploadPart.findUnique({ where: { uploadId_position: { uploadId: id, position } }, select: { checksum: true } });
      if (previous?.checksum === checksum) return { receivedBytes: upload.receivedBytes, nextPart: upload.nextPart };
      throw new UploadError('PART_CONFLICT', 'Phần tải lại khác dữ liệu đã nhận. Hãy tải lại file.', 409);
    }
    const expected = Math.min(DOCUMENT_PART_BYTES, upload.size - upload.receivedBytes);
    if (position !== upload.nextPart || content.length !== expected) throw new UploadError('PART_ORDER', 'Phần tải lên sai thứ tự hoặc dung lượng.', 409);
    const lock = await tx.documentUpload.updateMany({ where: { id, ownerId, status: 'uploading', nextPart: position, receivedBytes: upload.receivedBytes }, data: { receivedBytes: { increment: content.length }, nextPart: { increment: 1 } } });
    if (lock.count !== 1) throw new UploadError('PART_CONFLICT', 'Lần tải đã thay đổi. Hãy thử lại phần này.', 409);
    await tx.documentUploadPart.create({ data: { uploadId: id, position, checksum, content: new Uint8Array(content) } });
    return { receivedBytes: upload.receivedBytes + content.length, nextPart: position + 1 };
  });
}

function summary(doc: { id: string; title: string; fileType: string; size: number; status: string; rawText: string | null }, warnings: string[], chunkCount: number) {
  return { id: doc.id, title: doc.title, fileType: doc.fileType, size: doc.size, status: doc.status, chunkCount, warnings, counts: analyzeDocument(doc.rawText ?? '').counts };
}

export async function completeDocumentUpload(ownerId: string, id: string, signal?: AbortSignal) {
  if (!validUploadId(id)) throw new UploadError('INVALID_INPUT', 'Mã tải lên chưa hợp lệ.');
  const upload = await db.documentUpload.findFirst({ where: { id, ownerId, expiresAt: { gt: new Date() } } });
  if (!upload) throw new UploadError('NOT_FOUND', 'Lần tải đã hết hạn hoặc không thuộc tài khoản của bạn.', 404);
  if (upload.status === 'completed' && upload.documentId) {
    const doc = await db.document.findFirst({ where: { id: upload.documentId, ownerId }, include: { _count: { select: { chunks: true } } } });
    if (!doc) throw new UploadError('NOT_FOUND', 'Không tìm thấy tài liệu.', 404);
    const original = await db.documentFile.findUnique({ where: { documentId: doc.id }, select: { metadata: true } });
    const metadata = original?.metadata as { warnings?: string[] } | null;
    return summary(doc, metadata?.warnings ?? [], doc._count.chunks);
  }
  if (upload.receivedBytes !== upload.size) throw new UploadError('UPLOAD_INCOMPLETE', 'File chưa tải đủ các phần.', 409);
  const lease = new Date();
  const lock = await db.documentUpload.updateMany({ where: { id, ownerId, OR: [{ status: 'uploading' }, { status: 'processing', updatedAt: { lt: new Date(Date.now() - 600000) } }] }, data: { status: 'processing', updatedAt: lease } });
  if (lock.count !== 1) throw new UploadError('UPLOAD_BUSY', 'Tài liệu đang được đọc. Hãy chờ hoàn tất.', 409);
  try {
    const parts = await db.documentUploadPart.findMany({ where: { uploadId: id }, orderBy: { position: 'asc' } });
    const bytes = Buffer.concat(parts.map(part => Buffer.from(part.content)));
    if (bytes.length !== upload.size || parts.some((part, index) => part.position !== index || createHash('sha256').update(part.content).digest('hex') !== part.checksum)) throw new UploadError('UPLOAD_INCOMPLETE', 'Dữ liệu file chưa đầy đủ hoặc checksum không khớp.', 409);
    const extraction = await extractDocumentContent(bytes, upload.fileType, upload.filename, { ocr: true, signal });
    const doc = await transaction(async tx => {
      const held = await tx.documentUpload.updateMany({ where: { id, ownerId, status: 'processing', updatedAt: lease }, data: { status: 'completed', documentId: id } });
      if (held.count !== 1) throw new UploadError('UPLOAD_BUSY', 'Lần xử lý đã thay đổi. Hãy tải lại danh sách tài liệu.', 409);
      const document = await tx.document.create({ data: {
        id, ownerId, title: upload.filename.replace(/\.[^/.]+$/, ''), fileType: upload.fileType, size: upload.size,
        storageKey: `db:${id}`, rawText: extraction.rawText, status: extraction.needsOcr ? 'needs_ocr' : 'ready',
        chunks: { create: extraction.chunks },
        original: { create: { content: new Uint8Array(bytes), metadata: { revision: 1, warnings: extraction.warnings, method: extraction.method, needsOcr: extraction.needsOcr, pages: extraction.pages, answerMarks: extraction.answerMarks } } },
      } });
      await tx.documentUploadPart.deleteMany({ where: { uploadId: id } });
      return document;
    });
    return summary(doc, extraction.warnings, extraction.chunks.length);
  } catch (error) {
    await db.documentUpload.updateMany({ where: { id, ownerId, status: 'processing', updatedAt: lease }, data: { status: 'uploading' } }).catch(() => {});
    throw error;
  }
}

export async function cancelDocumentUpload(ownerId: string, id: string) {
  if (!validUploadId(id)) throw new UploadError('INVALID_INPUT', 'Mã tải lên chưa hợp lệ.');
  await db.documentUpload.deleteMany({ where: { id, ownerId, status: 'uploading' } });
}