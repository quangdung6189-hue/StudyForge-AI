import { db, transaction } from '@studyforge/db';
import { chunkText } from '@studyforge/core';
import { DalError } from './dal';

type Reading = {
  rawText: string; warnings: string[]; method: string; needsOcr: boolean;
  pages: { number: number; characters: number }[];
  answerMarks?: { text: string; mark: string; value: string; paragraph: number; confidence: string }[];
};

/** Commit text, chunks, status and metadata together; reject edits made during OCR. */
export async function applyDocumentReread(ownerId: string, id: string, revision: number, reading: Reading, originalBytes: Buffer) {
  return transaction(async tx => {
    const current = await tx.document.findFirst({ where: { id, ownerId, revision, status: 'extracting' }, select: { id: true, storageKey: true } });
    if (!current) throw new DalError('CONFLICT', 'Tài liệu đã được sửa trong lúc đọc lại. Bản mới chưa được ghi đè.');
    if (current.storageKey.startsWith('editor:') || current.storageKey.startsWith('editor-source:')) throw new DalError('CONFLICT', 'Nguồn biên soạn không hỗ trợ đọc lại file.');
    const nextRevision = revision + 1;
    const changed = await tx.document.updateMany({ where: { id, ownerId, revision, status: 'extracting' }, data: { rawText: reading.rawText, status: reading.needsOcr ? 'needs_ocr' : 'ready', revision: nextRevision, storageKey: `db:${id}` } });
    if (changed.count !== 1) throw new DalError('CONFLICT', 'Tài liệu đã thay đổi trong lúc đọc lại.');
    await tx.documentChunk.deleteMany({ where: { documentId: id } });
    const chunks = chunkText(reading.rawText, 1800, 250);
    if (chunks.length) await tx.documentChunk.createMany({ data: chunks.map(chunk => ({ ...chunk, documentId: id })) });
    const metadata = { revision: nextRevision, warnings: reading.warnings, method: reading.method, needsOcr: reading.needsOcr, pages: reading.pages, answerMarks: reading.answerMarks ?? [] };
    await tx.documentFile.upsert({ where: { documentId: id }, create: { documentId: id, content: new Uint8Array(originalBytes), metadata }, update: { metadata } });
    return { revision: nextRevision };
  });
}

export async function releaseDocumentReread(ownerId: string, previous: { id: string; status: string; revision: number }) {
  await db.document.updateMany({ where: { id: previous.id, ownerId, revision: previous.revision, status: 'extracting' }, data: { status: previous.status } });
}