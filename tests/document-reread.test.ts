import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/document-reread-test-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`; process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  return { databaseFile, user: vi.fn(), onRead: vi.fn(), docling: vi.fn() };
});
vi.mock('@/server/auth', () => ({ requireUser: fixture.user }));
vi.mock('@/server/docling', () => ({ readWithDocling: fixture.docling }));
vi.mock('@/server/extractor', async importOriginal => {
  const actual = await importOriginal<typeof import('../apps/web/src/server/extractor')>();
  return { ...actual, extractDocumentContent: async (...args: Parameters<typeof actual.extractDocumentContent>) => { await fixture.onRead(); return actual.extractDocumentContent(...args); } };
});
import { db } from '@studyforge/db';
import { POST as reread } from '../apps/web/src/app/api/documents/[id]/reprocess/route';
import { GET as detail } from '../apps/web/src/app/api/documents/[id]/route';
import { GET as exportDocument } from '../apps/web/src/app/api/documents/[id]/export/route';
import { readOriginalDocument, readExtractionMetadata } from '../apps/web/src/server/document-files';

let owner: string, intruder: string;
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (engine = 'native') => new Request('http://localhost/reprocess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine }) });
const source = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Hai cộng hai bằng bao nhiêu? Trả lời: 4\nGiải thích\nCộng hai nhóm.\nPHẦN IV. TỰ LUẬN\nCâu 18: Trình bày nguyên nhân.\na) Nêu nguyên nhân\nb) Nêu biện pháp\nTrả lời\na) Do điều kiện ban đầu.\nb) Thực hiện hai biện pháp.\nLời giải\nDẫn chứng nguồn.';
async function document(bytes: Buffer = Buffer.from(source), fileType = 'text/plain') {
  const id = randomUUID();
  return db.document.create({ data: { id, ownerId: owner, title: 'Reread fixture', fileType, size: bytes.length, storageKey: `db:${id}`, rawText: 'Bản đọc cũ chưa tách đúng đáp án.', status: 'ready', chunks: { create: { chunkIndex: 0, content: 'Bản đọc cũ chưa tách đúng đáp án.' } }, original: { create: { content: new Uint8Array(bytes), metadata: { revision: 1, warnings: [] } } } } });
}
beforeAll(async () => {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], { env: process.env, encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message || 'Test database setup failed');
  owner = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Owner', role: 'teacher' } })).id;
  intruder = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Other', role: 'student' } })).id;
}, 60000);
beforeEach(() => { fixture.user.mockReset().mockResolvedValue({ id: owner }); fixture.onRead.mockReset().mockResolvedValue(undefined); fixture.docling.mockReset(); });
afterAll(async () => { await db.$disconnect(); for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(fixture.databaseFile + suffix, { force: true }); });

describe('Reread stores written answers separately and commits one consistent revision', () => {
  it('rereads original TXT through actual API/extractor, preserving bytes, keys, essay and metadata', async () => {
    const doc = await document();
    for (let iteration = 0; iteration < 2; iteration++) {
      const response = await reread(request(), context(doc.id)); expect(response.status).toBe(200); expect((await response.json()).applied).toBe(true);
      const responseDetail = await detail(new Request('http://localhost/document'), context(doc.id));
      const saved = await responseDetail.json();
      expect(saved.revision).toBe(iteration + 2); expect(saved.status).toBe('ready');
      expect(saved.analysis.questions).toHaveLength(1); expect(saved.analysis.unsupported).toHaveLength(1);
      expect(saved.analysis.questions[0].stem).not.toMatch(/Trả lời|Cộng hai nhóm/);
      expect(saved.analysis.questions[0].documentAnswer.acceptedAnswers).toEqual(['4']);
      expect(saved.analysis.unsupported[0].stem).not.toContain('Do điều kiện');
      expect(saved.analysis.unsupported[0].documentAnswer.acceptedAnswers[0]).toContain('Thực hiện hai biện pháp.');
      expect(saved.extraction.revision).toBe(saved.revision);
      expect(saved.chunks.some((chunk: { content: string }) => chunk.content.includes('Trả lời: 4'))).toBe(true);
    }
    expect(await readOriginalDocument(owner, doc.storageKey)).toEqual(Buffer.from(source));
    const exported = await exportDocument(new Request('http://localhost/export?format=exam-pro'), context(doc.id));
    const data = await exported.json();
    expect(data.questions.map((q: { type: string }) => q.type)).toEqual(['SHORT_ANSWER', 'ESSAY']);
    expect(data.questions[0].correct_answer).toBe('4'); expect(data.questions[1].correct_answer).toContain('Do điều kiện');
  });
  it('uses the same boundaries for a real DOCX reread, including missing colon and multiline solutions', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${source.split('\n').map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
    const bytes = await zip.generateAsync({ type: 'nodebuffer' });
    const doc = await document(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect((await reread(request(), context(doc.id))).status).toBe(200);
    const saved = await (await detail(new Request('http://localhost'), context(doc.id))).json();
    expect(saved.analysis.questions[0].documentAnswer.acceptedAnswers).toEqual(['4']);
    expect(saved.analysis.questions[0].sourceExplanation).toBe('Cộng hai nhóm.');
    expect(saved.analysis.unsupported[0].documentAnswer.acceptedAnswers[0]).toContain('a) Do điều kiện');
    expect(await readOriginalDocument(owner, doc.storageKey)).toEqual(bytes);
  });
  it('rereads final section keys with repeated numbers and keeps source-only quiz answers outside student payloads', async () => {
    const text = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị bằng bao nhiêu?\nPHẦN IV. TỰ LUẬN\nBài 1: Trình bày thuật toán.\n**ĐÁP ÁN**\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: Đáp án – 1/2 | 0,5\nLời giải - Chia đôi.\nPHẦN IV. TỰ LUẬN\nBài 1: Dùng toán tử | để ghép điều kiện.\nBước hai: đối chiếu dữ liệu.';
    const doc = await document(Buffer.from(text));
    expect((await reread(request(), context(doc.id))).status).toBe(200);
    const saved = await (await detail(new Request('http://localhost'), context(doc.id))).json();
    expect(saved.analysis.questions[0].documentAnswer.acceptedAnswers).toEqual(['1/2', '0,5']);
    expect(saved.analysis.unsupported[0].documentAnswer.acceptedAnswers).toEqual(['Dùng toán tử | để ghép điều kiện.\nBước hai: đối chiếu dữ liệu.']);
    const { sourceQuiz } = await import('../apps/web/src/server/source-quiz');
    const { studentQuestions } = await import('@studyforge/core');
    const questions = sourceQuiz({ rawText: saved.rawText, chunks: saved.chunks, documentTitle: saved.title, types: ['short'], questionCount: 1 });
    expect(questions[0].answerOrigin).toBe('document'); expect(questions[0].reviewed).toBe(false);
    expect(text).toContain(questions[0].sourceRefs[0].quote);
    const student = studentQuestions({ title: saved.title, description: '', durationMinutes: 15, deadline: null, allowReview: false, questions }, 'reread');
    expect(student[0].stem).not.toMatch(/1\/2|0,5|Chia đôi|Đáp án/);
    expect(Object.keys(student[0]).sort()).toEqual(['id', 'options', 'points', 'stem', 'type']);
    const exported = await (await exportDocument(new Request('http://localhost/export?format=exam-pro'), context(doc.id))).json();
    expect(exported.questions).toHaveLength(2);
    expect(exported.questions[1].correct_answer).toBe('Dùng toán tử | để ghép điều kiện.\nBước hai: đối chiếu dữ liệu.');
  });
  it('does not expose a contradictory written key after reread or source-only generation', async () => {
    const text = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nĐáp án: 4\nTrả lời: 5';
    const doc = await document(Buffer.from(text));
    expect((await reread(request(), context(doc.id))).status).toBe(200);
    const saved = await (await detail(new Request('http://localhost'), context(doc.id))).json();
    expect(saved.analysis.questions[0].documentAnswer).toBeUndefined();
    expect(saved.analysis.questions[0].warnings.length).toBeGreaterThan(0);
    const { sourceQuiz } = await import('../apps/web/src/server/source-quiz');
    expect(() => sourceQuiz({ rawText: saved.rawText, chunks: saved.chunks, documentTitle: saved.title, types: ['short'], questionCount: 1 })).toThrow('đáp án gốc xác thực');
    const exported = await (await exportDocument(new Request('http://localhost/export?format=exam-pro'), context(doc.id))).json();
    expect(exported.questions[0].correct_answer).toBeNull();
  });
  it('does not overwrite a concurrent user edit while parsing is in progress', async () => {
    const doc = await document();
    fixture.onRead.mockImplementationOnce(async () => { await db.document.update({ where: { id: doc.id }, data: { rawText: 'Nội dung giáo viên vừa sửa', revision: { increment: 1 }, status: 'ready' } }); });
    const response = await reread(request(), context(doc.id)); expect(response.status).toBe(409);
    const saved = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(saved.rawText).toBe('Nội dung giáo viên vừa sửa'); expect(saved.status).toBe('ready'); expect(saved.revision).toBe(2);
    expect(await readExtractionMetadata(doc.id, 2, owner)).toBeNull();
  });
  it('retains existing text/chunks/metadata if OCR is partial or parsing fails', async () => {
    const doc = await document();
    fixture.docling.mockResolvedValue({ rawText: 'Đọc chưa chắc chắn', warnings: ['OCR chưa rõ'], method: 'docling', needsOcr: true, pages: [] });
    const partial = await reread(request('docling'), context(doc.id)); expect((await partial.json()).applied).toBe(false);
    fixture.onRead.mockRejectedValueOnce(new Error('Extractor failed'));
    expect((await reread(request(), context(doc.id))).status).toBe(502);
    const saved = await db.document.findUniqueOrThrow({ where: { id: doc.id }, include: { chunks: true } });
    expect(saved.rawText).toBe(doc.rawText); expect(saved.revision).toBe(1); expect(saved.status).toBe('ready');
    expect(saved.chunks).toHaveLength(1); expect((await readExtractionMetadata(doc.id, 1, owner))?.revision).toBe(1);
  });
  it('blocks guests, cross-owner rereads and editor sources', async () => {
    const doc = await document();
    fixture.user.mockResolvedValue({ id: intruder }); expect((await reread(request(), context(doc.id))).status).toBe(404);
    fixture.user.mockRejectedValue({ code: 'UNAUTHORIZED' }); expect((await reread(request(), context(doc.id))).status).toBe(401);
    fixture.user.mockResolvedValue({ id: owner });
    await db.document.update({ where: { id: doc.id }, data: { storageKey: `editor:${doc.id}` } });
    expect((await reread(request(), context(doc.id))).status).toBe(409);
    expect(fixture.onRead).not.toHaveBeenCalled();
  });
});