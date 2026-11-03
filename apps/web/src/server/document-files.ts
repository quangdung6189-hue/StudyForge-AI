import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { db, readWithRetry } from '@studyforge/db';
import { LocalPrivateStorage } from '@studyforge/storage';

const root = () => process.env.STUDYFORGE_ROOT ?? process.cwd();
export const documentStorage = (directory = path.resolve(root(), process.env.PRIVATE_STORAGE_DIR ?? '.data/storage')) => new LocalPrivateStorage(directory, async (principal, key) => Boolean(await db.document.findFirst({ where: { ownerId: principal.id, storageKey: key }, select: { id: true } })));

export async function readOriginalDocument(userId: string, storageKey: string, documentId?: string) {
  const docId = documentId ?? (storageKey.startsWith('db:') ? storageKey.slice(3) : null);
  if (docId) {
    const record = await readWithRetry(() => db.documentFile.findFirst({
      where: { documentId: docId, document: { ownerId: userId } },
      select: { content: true }
    }));
    if (record?.content) return Buffer.from(record.content);
  }
  const configured = process.env.PRIVATE_STORAGE_DIR ?? '.data/uploads';
  const locations = [
    ...new Set([
      path.resolve(root(), configured),
      path.resolve(root(), 'apps/web', configured),
      path.resolve(root(), '.data/storage'),
      path.resolve(root(), 'apps/web/.data/storage'),
      path.resolve(root(), '.data/uploads'),
      path.resolve(root(), 'apps/web/.data/uploads'),
    ])
  ];
  for (const location of locations) {
    try {
      const bytes = await documentStorage(location).read({ id: userId }, storageKey);
      if (bytes && bytes.length > 0) return bytes;
    } catch {}
  }

  // Fallback: if raw binary bytes were lost on ephemeral storage, fall back to stored rawText
  if (docId) {
    const fallbackDoc = await readWithRetry(() => db.document.findFirst({
      where: { id: docId, ownerId: userId },
      select: { rawText: true }
    }));
    if (fallbackDoc?.rawText) {
      return Buffer.from(fallbackDoc.rawText, 'utf8');
    }
  }

  throw new Error('Không tìm được file gốc trong kho riêng. Văn bản đã lưu vẫn được giữ; bạn có thể tải lại file.');
}
const metadataPath = (id: string) => {
  if (!/^[\da-f-]{36}$/i.test(id)) throw new Error('Invalid document ID');
  return path.join(root(), '.data', 'document-extraction', `${id}.json`);
};
export async function saveExtractionMetadata(id: string, revision: number, extraction: { warnings: string[]; method: string; needsOcr: boolean; pages: { number: number; characters: number }[]; answerMarks?: { text: string; mark: string; value: string; paragraph: number; confidence: string }[] }, userId: string) {
  const metadata = { revision, warnings: extraction.warnings, method: extraction.method, needsOcr: extraction.needsOcr, pages: extraction.pages, answerMarks: extraction.answerMarks ?? [] };
  const result = await db.documentFile.updateMany({ where: { documentId: id, document: { ownerId: userId, revision } }, data: { metadata } });
  if (result.count) return;
  if (!await db.document.findFirst({ where: { id, ownerId: userId, revision }, select: { id: true } })) throw new Error('File access denied');
  const filename = metadataPath(id); await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  await writeFile(filename, JSON.stringify(metadata), { mode: 0o600 });
}
export async function readExtractionMetadata(id: string, revision: number, userId: string) {
  const record = await readWithRetry(() => db.documentFile.findFirst({ where: { documentId: id, document: { ownerId: userId } }, select: { metadata: true } }));
  if (record?.metadata) {
    const metadata = record.metadata as { revision?: number };
    return metadata.revision === revision ? metadata : null;
  }
  if (!await db.document.findFirst({ where: { id, ownerId: userId }, select: { id: true } })) return null;
  try { const metadata = JSON.parse(await readFile(metadataPath(id), 'utf8')); return metadata.revision === revision ? metadata : null; } catch { return null; }
}
