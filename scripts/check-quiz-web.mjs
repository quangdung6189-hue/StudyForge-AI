import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { db } from '../packages/db/src/index.ts';
import { assertCitations } from '@studyforge/core';
import { QuestionListSchema } from '@studyforge/contracts';

const baseURL = process.env.APP_URL ?? 'http://localhost:3000';
const content = `Kiến thức: Hai nhóm, mỗi nhóm 2 phần tử, gộp lại có 4 phần tử. Phép cộng 2 + 2 = 4. Số 4 là số chẵn vì chia hết cho 2.
PHẦN I. Trắc nghiệm
Câu 1. Hai cộng hai bằng bao nhiêu?
A. 3   B. 4   C. 5   D. 6
PHẦN II. Đúng sai
Câu 1. Xét phép tính 2 + 2 = 4.
a) Kết quả là số chẵn.
b) Kết quả bằng 5.
PHẦN III. Trả lời ngắn
Câu 1. Tính 2 + 2.`;
let userId;
let result;
try {
  const user = await db.user.create({ data: { email: `quiz-ai-web-${randomUUID()}@example.com`, name: 'AI integration check', role: 'teacher' } });
  userId = user.id;
  const doc = await db.document.create({ data: { ownerId: userId, title: 'Real AI API verification', storageKey: `integration-check/${randomUUID()}`, fileType: 'text/plain', size: Buffer.byteLength(content), status: 'ready', rawText: content, chunks: { create: { chunkIndex: 0, content } } }, include: { chunks: true } });
  const token = randomBytes(32).toString('hex');
  await db.session.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 600_000) } });
  const started = Date.now();
  const response = await fetch(`${baseURL}/api/quizzes/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `studyforge_session=${token}` }, signal: AbortSignal.timeout(150_000),
    body: JSON.stringify({ documentId: doc.id, mode: 'ai_generate', questionCount: 3, types: ['single', 'boolean', 'short'] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Website HTTP ${response.status}: ${data.error?.code ?? 'ERROR'}`);
  const questions = QuestionListSchema.parse(data.questions);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions.map(q => q.type), ['single', 'boolean', 'short']);
  assertCitations(questions, doc.chunks);
  assert(questions.every(q => q.explanation.includes('Bước 2:') && !q.reviewed));
  result = { success: true, endpoint: '/api/quizzes/generate', status: response.status, model: process.env.AI_MODEL_GENERATE, elapsedMs: Date.now() - started, count: questions.length, types: questions.map(q => q.type), citations: true, detailedSolutions: true, realProvider: true };
  console.log(JSON.stringify(result));
} catch (error) {
  result = { success: false, message: error.message };
  console.log(JSON.stringify(result)); process.exitCode = 1;
} finally {
  if (userId) { await db.document.deleteMany({ where: { ownerId: userId } }); await db.user.delete({ where: { id: userId } }); }
  await db.$disconnect();
  await mkdir('.data', { recursive: true });
  await writeFile('.data/quiz-ai-web-check.json', JSON.stringify(result, null, 2));
}
