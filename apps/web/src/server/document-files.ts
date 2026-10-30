import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { db } from '@studyforge/db';
import { LocalPrivateStorage } from '@studyforge/storage';

const root = () => process.env.STUDYFORGE_ROOT ?? process.cwd();
export const documentStorage = (directory = path.resolve(root(), process.env.PRIVATE_STORAGE_DIR ?? '.data/storage')) => new LocalPrivateStorage(directory, async (principal, key) => Boolean(await db.document.findFirst({ where: { ownerId: principal.id, storageKey: key }, select: { id: true } })));

export async function readOriginalDocument(userId: string, storageKey: string) {
  // Earlier releases resolved relative storage against apps/web. Retain access to those originals.
  const configured = process.env.PRIVATE_STORAGE_DIR ?? '.data/storage';
  const locations = [...new Set([path.resolve(root(), configured), path.resolve(root(), 'apps/web', configured), path.resolve(root(), '.data/storage'), path.resolve(root(), 'apps/web/.data/storage')])];
  for (const location of locations) { try { return await documentStorage(location).read({ id: userId }, storageKey); } catch {} }
  throw new Error('Không tìm được file gốc trong kho riêng. Văn bản đã lưu vẫn được giữ; bạn có thể tải lại file.');
}
const metadataPath = (id: string) => {
  if (!/^[\da-f-]{36}$/i.test(id)) throw new Error('Invalid document ID');
  return path.join(root(), '.data', 'document-extraction', `${id}.json`);
};
export async function saveExtractionMetadata(id: string, revision: number, extraction: { warnings: string[]; method: string; needsOcr: boolean; pages: { number: number; characters: number }[] }) {
  const filename = metadataPath(id); await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  await writeFile(filename, JSON.stringify({ revision, warnings: extraction.warnings, method: extraction.method, needsOcr: extraction.needsOcr, pages: extraction.pages }), { mode: 0o600 });
}
export async function readExtractionMetadata(id: string, revision: number) {
  try { const metadata = JSON.parse(await readFile(metadataPath(id), 'utf8')); return metadata.revision === revision ? metadata : null; } catch { return null; }
}
