import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/exam-draft-test-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`; process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  return { databaseFile, user: vi.fn() };
});
vi.mock('@/server/auth', () => ({ requireUser: fixture.user }));
import { db } from '@studyforge/db';
import { saveExamDraft, readExamDraft, prepareExamQuestions, listExamDrafts } from '../apps/web/src/server/exam-drafts';
import { POST as save } from '../apps/web/src/app/api/exam-drafts/route';
import { GET as get } from '../apps/web/src/app/api/exam-drafts/[id]/route';
import { saveQuiz } from '../apps/web/src/server/quiz-save';
import { publishOwnedQuiz, startQuizAttempt, updateOwnedDocument, listUserDocuments } from '../apps/web/src/server/dal';
import { EXAM_SAMPLE } from '../apps/web/src/lib/exam-code';
import { QuestionListSchema } from '@studyforge/contracts';
let owner: string, intruder: string;
const draft = (code = EXAM_SAMPLE) => ({ id: randomUUID(), code, title: 'Đề kiểm tra', minutes: 15, revision: 0, sourceDocumentId: null });
beforeAll(async () => {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], { env: process.env, encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  owner = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Teacher', role: 'teacher' } })).id;
  intruder = (await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Other', role: 'student' } })).id;
}, 60000);
afterAll(async () => { await db.$disconnect(); for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(fixture.databaseFile + suffix, { force: true }); });
describe('Real exam drafts, incomplete content and strict publication', () => {
  it('persists incomplete text and settings but cannot prepare or invent an answer', async () => {
    const input = draft('Câu 1: Chọn\nA. Một\nB. Hai');
    const saved = await saveExamDraft(owner, input);
    expect(saved.revision).toBe(1); expect((await readExamDraft(owner, input.id)).code).toBe(input.code);
    expect((await listExamDrafts(owner)).items.some(item => item.id === input.id)).toBe(true);
    expect((await listExamDrafts(intruder)).items.some(item => item.id === input.id)).toBe(false);
    await expect(prepareExamQuestions(owner, input.id, 1)).rejects.toMatchObject({ code: 'INVALID_EXAM' });
    expect(await db.quiz.count()).toBe(0);
  });
  it('blocks owner swapping, guests, oversized payloads and stale revisions', async () => {
    const input = draft(); const saved = await saveExamDraft(owner, input);
    await expect(readExamDraft(intruder, input.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(saveExamDraft(intruder, { ...input, revision: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(prepareExamQuestions(intruder, input.id, 1)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(saveExamDraft(owner, { ...input, code: input.code + '\nChanged', revision: 0 })).rejects.toMatchObject({ code: 'CONFLICT' });
    const updated = await saveExamDraft(owner, { ...input, revision: saved.revision, title: 'New title' });
    expect(updated.revision).toBe(2);
    fixture.user.mockRejectedValue({ code: 'UNAUTHORIZED', message: 'Đăng nhập' });
    expect((await get(new Request('http://localhost'), { params: Promise.resolve({ id: input.id }) })).status).toBe(401);
    expect((await save(new Request('http://localhost', { method: 'POST', body: JSON.stringify(input) }))).status).toBe(401);
    fixture.user.mockResolvedValue({ id: owner });
    expect((await save(new Request('http://localhost', { method: 'POST', headers: { 'Content-Length': '1500001' }, body: '{}' }))).status).toBe(413);
  });
  it('saves and publishes three source formats using real citations, never marking questions reviewed automatically', async () => {
    const input = draft(); const saved = await saveExamDraft(owner, input);
    const prepared = await prepareExamQuestions(owner, saved.id, saved.revision);
    expect(prepared.questions).toHaveLength(4); expect(QuestionListSchema.safeParse(prepared.questions).success).toBe(true);
    expect(prepared.questions.every(q => !q.reviewed && q.sourceRefs.length)).toBe(true);
    expect(prepared.questions.filter(q => q.type === 'boolean').map(q => q.options.find(o => q.correctOptionIds.includes(o.id))?.text)).toEqual(['Đúng', 'Sai']);
    const quiz = await saveQuiz(owner, { documentId: prepared.documentId, title: input.title, questions: prepared.questions, durationMinutes: input.minutes });
    await expect(publishOwnedQuiz(owner, quiz.quiz.id, { allowReview: true })).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.question.updateMany({ where: { bankId: quiz.quiz.bankId }, data: { reviewed: true } });
    const published = await publishOwnedQuiz(owner, quiz.quiz.id, { allowReview: true });
    const attempt = await startQuizAttempt({ id: intruder, email: 'student@test.invalid', name: 'Student', role: 'student' }, { shareCode: published.shareCode });
    expect(JSON.stringify(attempt.questions)).not.toMatch(/correctOptionIds|acceptedAnswers|answerOrigin|sourceRefs|explanation/);
  });
  it('recognizes matching lost-response retries without overwriting newer content', async () => {
    const input = draft(); const one = await saveExamDraft(owner, input);
    const retried = await saveExamDraft(owner, input); expect(retried.revision).toBe(one.revision);
    const two = await saveExamDraft(owner, { ...input, revision: one.revision, code: input.code + '\n\n' });
    await expect(saveExamDraft(owner, input)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(two.revision).toBe(2);
  });
  it('isolates question IDs between drafts and preserves quiz source citations after editing', async () => {
    const first = await saveExamDraft(owner, draft()); const second = await saveExamDraft(owner, draft());
    const a = await prepareExamQuestions(owner, first.id, 1), b = await prepareExamQuestions(owner, second.id, 1);
    expect(a.questions[0].id).not.toBe(b.questions[0].id);
    expect(a.documentId).not.toBe(first.id);
    const chunks = await db.documentChunk.findMany({ where: { documentId: a.documentId } });
    await saveExamDraft(owner, { id: first.id, title: first.title, minutes: first.minutes, sourceDocumentId: first.sourceDocumentId, code: 'Câu 1: Đề mới chưa đủ đáp án', revision: 1 });
    for (const ref of a.questions.flatMap(q => q.sourceRefs)) expect(chunks.find(c => c.id === ref.chunkId)?.content).toContain(ref.quote);
    expect(await db.documentChunk.count({ where: { documentId: a.documentId } })).toBe(chunks.length);
    await expect(updateOwnedDocument(owner, a.documentId, { rawText: 'Changed source' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await listUserDocuments(owner)).items.some(item => [a.documentId, first.id].includes(item.id))).toBe(false);
  });
});