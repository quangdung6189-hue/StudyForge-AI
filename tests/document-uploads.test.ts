import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';

const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/document-upload-test-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`;
  process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  process.env.STUDYFORGE_ROOT = process.cwd();
  return { databaseFile, requireUser: vi.fn() };
});
vi.mock('@/server/auth', () => ({ requireUser: fixture.requireUser }));
// Only OCR uses AI. Keep native DOCX/PDF/TXT parsing real and never call a live gateway.
vi.mock('@studyforge/ai', () => ({ gatewayFromEnv: () => { throw new Error('OCR gateway unavailable in upload test'); } }));
import { db } from '@studyforge/db';
import { POST as start } from '../apps/web/src/app/api/documents/uploads/route';
import { PUT as part, DELETE as cancel } from '../apps/web/src/app/api/documents/uploads/[id]/route';
import { POST as complete } from '../apps/web/src/app/api/documents/uploads/[id]/complete/route';
import { POST as legacy } from '../apps/web/src/app/api/documents/upload/route';
import { GET as original } from '../apps/web/src/app/api/documents/[id]/file/route';
import { getOwnedDocument } from '../apps/web/src/server/dal';
import { readOriginalDocument, readExtractionMetadata, saveExtractionMetadata } from '../apps/web/src/server/document-files';
import { DOCUMENT_PART_BYTES, DOCUMENT_MAX_BYTES, uploadResponseError } from '../apps/web/src/lib/document-upload';

let owner: string, intruder: string;
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) => new Request('http://localhost/api/documents/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const empty = () => new Request('http://localhost/api/documents/uploads/id/complete', { method: 'POST' });
const sendPart = (id: string, bytes: Uint8Array, position = 0) => part(new Request('http://localhost/api/documents/uploads/id', { method: 'PUT', headers: { 'X-Upload-Part': String(position) }, body: new Uint8Array(bytes) }), context(id));
async function begin(filename: string, size: number) {
  const response = await start(json({ filename, size }));
  expect(response.status).toBe(201);
  const data = await response.json(); expect(data.partBytes).toBe(DOCUMENT_PART_BYTES);
  return data.uploadId as string;
}
async function upload(filename: string, bytes: Buffer) {
  const id = await begin(filename, bytes.length);
  for (let offset = 0, position = 0; offset < bytes.length; offset += DOCUMENT_PART_BYTES, position++) {
    expect((await sendPart(id, bytes.subarray(offset, offset + DOCUMENT_PART_BYTES), position)).status).toBe(200);
  }
  const response = await complete(empty(), context(id));
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()).documents[0] as { id: string; chunkCount: number; warnings: string[] };
}

beforeAll(async () => {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], { env: process.env, encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  owner = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Owner', role: 'teacher' } })).id;
  intruder = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Other', role: 'student' } })).id;
}, 60000);
beforeEach(() => { fixture.requireUser.mockResolvedValue({ id: owner }); });
afterAll(async () => { await db.$disconnect(); for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(fixture.databaseFile + suffix, { force: true }); });

describe('Durable private document uploads on read-only serverless hosts', () => {
  it('blocks every upload and file operation without a session', async () => {
    fixture.requireUser.mockRejectedValue({ code: 'UNAUTHORIZED' });
    const id = randomUUID();
    expect((await start(json({ filename: 'private.txt', size: 5 }))).status).toBe(401);
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(401);
    expect((await complete(empty(), context(id))).status).toBe(401);
    expect((await cancel(empty(), context(id))).status).toBe(401);
    expect((await original(empty(), context(id))).status).toBe(401);
    expect(await db.documentUpload.count()).toBe(0);
  });

  it('stores original bytes and metadata in DB without any writable local directory', async () => {
    const previous = process.env.STUDYFORGE_ROOT;
    process.env.STUDYFORGE_ROOT = 'Z:/not-a-real-drive/read-only';
    try {
      const bytes = Buffer.from('PHẦN I. Trắc nghiệm\nCâu 1. Hai cộng hai?\nA. Ba\nB. Bốn [Đáp án]');
      const doc = await upload('Tiếng Việt.txt', bytes);
      expect(await readOriginalDocument(owner, `db:${doc.id}`)).toEqual(bytes);
      expect((await readExtractionMetadata(doc.id, 1, owner))?.revision).toBe(1);
      const detail = await getOwnedDocument(owner, doc.id);
      expect(detail.rawText).toContain('Bốn'); expect(doc.chunkCount).toBeGreaterThan(0);
      expect(JSON.stringify(detail)).not.toMatch(/"content":\{"type":"Buffer"|"original"|"storageKey"/);
      expect(await db.documentUploadPart.count({ where: { uploadId: doc.id } })).toBe(0);
      expect((await complete(empty(), context(doc.id))).status).toBe(200);
      expect(await db.document.count({ where: { id: doc.id } })).toBe(1);
    } finally { process.env.STUDYFORGE_ROOT = previous; }
  });

  it('checks owner for append, finalize, cancel, metadata and original file reads', async () => {
    const id = await begin('private.txt', 5);
    fixture.requireUser.mockResolvedValue({ id: intruder });
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(404);
    expect((await complete(empty(), context(id))).status).toBe(404);
    expect((await cancel(empty(), context(id))).status).toBe(204);
    expect(await db.documentUpload.findUnique({ where: { id } })).not.toBeNull();
    fixture.requireUser.mockResolvedValue({ id: owner });
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(200);
    expect((await complete(empty(), context(id))).status).toBe(200);
    await expect(readOriginalDocument(intruder, `db:${id}`)).rejects.toThrow();
    expect(await readExtractionMetadata(id, 1, intruder)).toBeNull();
    await expect(saveExtractionMetadata(id, 1, { method: 'native', warnings: [], needsOcr: false, pages: [] }, intruder)).rejects.toThrow();
    fixture.requireUser.mockResolvedValue({ id: intruder });
    expect((await original(empty(), context(id))).status).toBe(404);
  });

  it('accepts identical part retries, rejects altered data and incorrect part order', async () => {
    const id = await begin('retry.txt', 5);
    expect((await sendPart(id, Buffer.from('hello'), 1)).status).toBe(409);
    expect((await sendPart(id, Buffer.from('hell'))).status).toBe(409);
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(200);
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(200);
    expect((await sendPart(id, Buffer.from('other'))).status).toBe(409);
    expect(await db.documentUploadPart.count({ where: { uploadId: id } })).toBe(1);
    expect((await cancel(empty(), context(id))).status).toBe(204);
    expect(await db.documentUploadPart.count({ where: { uploadId: id } })).toBe(0);
  });

  it('validates file limits, input, request stream limits, completion and expiry', async () => {
    for (const input of [{ filename: 'x.exe', size: 5 }, { filename: 'x.constructor', size: 5 }, { filename: 'x.__proto__', size: 5 }, { filename: 'pdf', size: 5 }, { filename: 'x.pdf', size: 0 }, { filename: 'x.pdf', size: DOCUMENT_MAX_BYTES + 1 }]) expect((await start(json(input))).status).toBe(400);
    const id = await begin('incomplete.txt', 5);
    expect((await complete(empty(), context(id))).status).toBe(409);
    expect((await sendPart(id, Buffer.alloc(DOCUMENT_PART_BYTES + 1))).status).toBe(413);
    await db.documentUpload.update({ where: { id }, data: { expiresAt: new Date(0) } });
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(404);
    const clean = await begin('cleanup.txt', 5);
    expect(await db.documentUpload.findUnique({ where: { id } })).toBeNull();
    await cancel(empty(), context(clean));
  });

  it('uploads a file above the 4.5MB platform limit in 1MB requests and streams private ranges', async () => {
    // Image OCR is disabled by the fixture gateway and falls back to needs_ocr, retaining bytes.
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 13, 0x41);
    const doc = await upload('large.png', bytes);
    expect((await readOriginalDocument(owner, `db:${doc.id}`)).length).toBe(bytes.length);
    const response = await original(new Request('http://localhost/file', { headers: { Range: 'bytes=5-15' } }), context(doc.id));
    expect(response.status).toBe(206); expect(response.headers.get('Content-Range')).toBe(`bytes 5-15/${bytes.length}`);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes.subarray(5, 16));
    expect((await original(new Request('http://localhost/file', { headers: { Range: 'bytes=99999999-' } }), context(doc.id))).status).toBe(416);
  });

  it('parses real DOCX and retains original and metadata after a fresh Prisma connection', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Đáp án đề cương trong tài liệu gốc.</w:t></w:r></w:p></w:body></w:document>');
    const bytes = await zip.generateAsync({ type: 'nodebuffer' });
    const doc = await upload('Đáp án.docx', bytes);
    await db.$disconnect();
    expect(await readOriginalDocument(owner, `db:${doc.id}`)).toEqual(bytes);
    expect((await getOwnedDocument(owner, doc.id)).rawText).toContain('Đáp án đề cương');
    expect(await readExtractionMetadata(doc.id, 1, owner)).not.toBeNull();
  });

  it('parses and preserves a real PDF with native text', async () => {
    const text = 'StudyForge original PDF document with enough visible study text for faithful native extraction and review.';
    const content = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = Buffer.from(pdf);
    const doc = await upload('native.pdf', bytes);
    expect((await getOwnedDocument(owner, doc.id)).rawText).toContain('StudyForge original PDF');
    expect(await readOriginalDocument(owner, `db:${doc.id}`)).toEqual(bytes);
  });

  it('keeps the legacy multipart endpoint functional without local file writes', async () => {
    const form = new FormData(); form.append('files', new File(['Legacy text document'], 'legacy.txt'));
    const response = await legacy(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
  });

  it('checks stored part integrity before extraction and never persists a corrupt original', async () => {
    const id = await begin('corrupt.txt', 5);
    expect((await sendPart(id, Buffer.from('hello'))).status).toBe(200);
    await db.documentUploadPart.update({ where: { uploadId_position: { uploadId: id, position: 0 } }, data: { content: new Uint8Array(Buffer.from('other')) } });
    expect((await complete(empty(), context(id))).status).toBe(409);
    expect(await db.document.findUnique({ where: { id } })).toBeNull();
    expect((await db.documentUpload.findUnique({ where: { id } }))?.status).toBe('uploading');
    await cancel(empty(), context(id));
  });

  it('enforces upload quotas in DB without creating another upload', async () => {
    const window = Math.floor(Date.now() / 900000), id = `upload:${owner}:${window}`;
    await db.rateLimitBucket.upsert({ where: { id }, create: { id, count: 100, expiresAt: new Date(Date.now() + 900000) }, update: { count: 100 } });
    const before = await db.documentUpload.count();
    const response = await start(json({ filename: 'rate-limit.txt', size: 5 }));
    expect(response.status).toBe(429);
    expect(await db.documentUpload.count()).toBe(before);
  });
});

describe('Actionable client upload errors', () => {
  it('handles platform HTML/text errors without hiding the cause behind JSON parse errors', () => {
    expect(uploadResponseError(413, 'FUNCTION_PAYLOAD_TOO_LARGE')).toContain('quá lớn');
    expect(uploadResponseError(401, '<html>login</html>')).toContain('đăng nhập');
    expect(uploadResponseError(503, JSON.stringify({ error: { message: 'Database chưa cập nhật' } }))).toBe('Database chưa cập nhật');
    expect(uploadResponseError(504, '')).toContain('quá thời gian');
  });
});