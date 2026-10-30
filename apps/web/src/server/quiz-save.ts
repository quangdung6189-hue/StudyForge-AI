import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db, transaction } from '@studyforge/db';
import { QuizCreateSchema, QuestionListSchema } from '@studyforge/contracts';
import { assertCitations } from '@studyforge/core';
import { DalError } from './dal';

export const QuizSaveSchema = QuizCreateSchema.extend({ durationMinutes: z.number().int().min(1).max(1440).default(30), requestId: z.string().uuid().optional() });
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Retry only a matching operation ID: a lost HTTP response cannot create a second bank. */
async function existingSave(ownerId: string, input: z.infer<typeof QuizSaveSchema>) {
  if (!input.requestId) return null;
  const existing = await db.quiz.findFirst({ where: { id: input.requestId, ownerId }, include: { bank: { include: { questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } } } } } });
  if (!existing) return null;
  const actual = QuestionListSchema.parse(existing.bank.questions.map(q => ({ id: q.id, type: q.type, stem: q.stem, options: q.options.map(o => ({ id: o.id, text: o.text })), correctOptionIds: q.correctOptionIds, acceptedAnswers: q.acceptedAnswers, explanation: q.explanation, points: q.points, difficulty: q.difficulty, topic: q.topic, answerOrigin: q.answerOrigin, sourceRefs: q.sourceRefs, reviewed: q.reviewed })));
  if (existing.bank.documentId !== input.documentId || existing.title !== input.title || existing.description !== input.description || existing.durationMinutes !== input.durationMinutes || fingerprint(actual) !== fingerprint(input.questions)) throw new DalError('CONFLICT', 'Mã bản nháp đã được dùng cho nội dung khác. Hãy mở bản đã lưu trong ngân hàng đề.');
  return { quiz: { id: existing.id, title: existing.title, bankId: existing.bankId, questionCount: actual.length }, reused: true };
}

export async function saveQuiz(ownerId: string, raw: unknown) {
  const input = QuizSaveSchema.parse(raw), { documentId, title, description, durationMinutes, questions } = input;
  const existing = await existingSave(ownerId, input); if (existing) return existing;
  try {
    return await transaction(async tx => {
      const doc = await tx.document.findFirst({ where: { id: documentId, ownerId }, select: { chunks: true } });
      if (!doc) throw new DalError('NOT_FOUND', 'Không tìm thấy tài liệu của bạn.');
      try { assertCitations(questions, doc.chunks); } catch { throw Object.assign(new Error('Trích dẫn không khớp tài liệu hiện tại. Hãy tạo lại câu hỏi.'), { code: 'INVALID_CITATION' }); }
      const bank = await tx.questionBank.create({ data: { ownerId, documentId, title } });
      await tx.question.createMany({ data: questions.map(({ options, ...q }, position) => ({ ...q, bankId: bank.id, position })) });
      const options = questions.flatMap(q => q.options.map((option, position) => ({ ...option, questionId: q.id, position })));
      if (options.length) await tx.questionOption.createMany({ data: options });
      const quiz = await tx.quiz.create({ data: { ...(input.requestId ? { id: input.requestId } : {}), ownerId, bankId: bank.id, title, description, durationMinutes } });
      return { quiz: { id: quiz.id, title, bankId: bank.id, questionCount: questions.length }, reused: false };
    });
  } catch (error) {
    // Concurrent duplicate submissions roll back, then resolve the already committed operation.
    if ((error as { code?: string }).code === 'P2002') { const saved = await existingSave(ownerId, input); if (saved) return saved; }
    throw error;
  }
}
