import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db, transaction } from '@studyforge/db';
import { chunkText } from '@studyforge/core';
import { QuestionListSchema, type FullQuestionDTO } from '@studyforge/contracts';
import { examId, parseExamCode, questionCode } from '@/lib/exam-code';
import { examValidationMessage, isManualQuestion } from '@/lib/exam-review';
import { DalError } from './dal';

export const ExamDraftInput = z.strictObject({
  id: z.uuid(), code: z.string().max(250000), title: z.string().trim().max(200),
  minutes: z.number().int().min(1).max(1440), revision: z.number().int().min(0), sourceDocumentId: z.uuid().nullable().default(null),
  mediaMap: z.record(z.string(), z.string()).optional(),
});
export type ExamDraftValue = z.infer<typeof ExamDraftInput>;
type Metadata = { editorDraft?: { title: string; minutes: number; sourceDocumentId: string | null; format: 'studyforge.exam.v1'; mediaMap?: Record<string, string> } };

export async function readExamDraft(ownerId: string, id: string) {
  const doc = await db.document.findFirst({ where: { id, ownerId, storageKey: `editor:${id}` }, include: { original: { select: { metadata: true } } } });
  const metadata = doc?.original?.metadata as Metadata | null;
  if (!doc || !metadata?.editorDraft) throw new DalError('NOT_FOUND', 'Không tìm thấy bản soạn đề của bạn.');
  return { id: doc.id, code: doc.rawText ?? '', title: metadata.editorDraft.title, minutes: metadata.editorDraft.minutes, sourceDocumentId: metadata.editorDraft.sourceDocumentId, mediaMap: metadata.editorDraft.mediaMap || {}, revision: doc.revision, savedAt: doc.updatedAt.toISOString() };
}

export async function listExamDrafts(ownerId: string) {
  const documents = await db.document.findMany({ where: { ownerId, storageKey: { startsWith: 'editor:' } }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, title: true, revision: true, updatedAt: true } });
  return { items: documents.map(document => ({ ...document, updatedAt: document.updatedAt.toISOString() })) };
}

export async function saveExamDraft(ownerId: string, raw: unknown) {
  const input = ExamDraftInput.parse(raw);
  const saved = await transaction(async tx => {
    if (input.sourceDocumentId && !await tx.document.findFirst({ where: { id: input.sourceDocumentId, ownerId }, select: { id: true } })) throw new DalError('NOT_FOUND', 'Không tìm thấy tài liệu nguồn của bạn.');
    const metadata = { editorDraft: { title: input.title, minutes: input.minutes, sourceDocumentId: input.sourceDocumentId, format: 'studyforge.exam.v1' as const, ...(input.mediaMap ? { mediaMap: input.mediaMap } : {}) } };
    const existing = await tx.document.findUnique({ where: { id: input.id }, select: { ownerId: true, revision: true, updatedAt: true, storageKey: true, rawText: true, original: { select: { metadata: true } } } });
    const data = { title: input.title || 'Bản soạn đề chưa đặt tên', rawText: input.code, size: Buffer.byteLength(input.code) };
    if (!existing) {
      if (input.revision !== 0) throw new DalError('CONFLICT', 'Bản nháp đã thay đổi. Hãy mở lại trước khi lưu.');
      await tx.document.create({ data: { id: input.id, ownerId, ...data, fileType: 'text/plain', storageKey: `editor:${input.id}`, status: 'ready', revision: 1, chunks: { create: chunkText(input.code) }, original: { create: { content: new Uint8Array(Buffer.from(input.code)), metadata } } } });
    } else {
      if (existing.ownerId !== ownerId || existing.storageKey !== `editor:${input.id}`) throw new DalError('NOT_FOUND', 'Không tìm thấy bản soạn đề của bạn.');
      // A lost response may retry the exact operation; different stale content is a conflict.
      if (existing.revision !== input.revision) {
        const previous = existing.original?.metadata as Metadata | null;
        if (existing.rawText === input.code && previous?.editorDraft?.title === input.title && previous.editorDraft.minutes === input.minutes && previous.editorDraft.sourceDocumentId === input.sourceDocumentId) return { revision: existing.revision, updatedAt: existing.updatedAt };
        throw new DalError('CONFLICT', 'Bản nháp đã được sửa ở tab khác. Giữ nội dung hiện tại và mở lại bản mới trước khi ghi đè.');
      }
      const updated = await tx.document.updateMany({ where: { id: input.id, ownerId, revision: input.revision }, data: { ...data, revision: { increment: 1 } } });
      if (updated.count !== 1) throw new DalError('CONFLICT', 'Bản nháp đã thay đổi ở nơi khác.');
      await tx.documentChunk.deleteMany({ where: { documentId: input.id } });
      const chunks = chunkText(input.code);
      if (chunks.length) await tx.documentChunk.createMany({ data: chunks.map(chunk => ({ ...chunk, documentId: input.id })) });
      await tx.documentFile.update({ where: { documentId: input.id }, data: { content: new Uint8Array(Buffer.from(input.code)), metadata } });
    }
    return tx.document.findUniqueOrThrow({ where: { id: input.id }, select: { revision: true, updatedAt: true } });
  });
  return { ...input, revision: saved.revision, savedAt: saved.updatedAt.toISOString() };
}

export async function prepareExamQuestions(ownerId: string, id: string, revision: number, options: { excludeManual?: boolean } = {}) {
  return transaction(async tx => {
    const doc = await tx.document.findFirst({ where: { id, ownerId, storageKey: `editor:${id}`, revision }, include: { chunks: true, original: { select: { metadata: true } } } });
    if (!doc) throw new DalError('CONFLICT', 'Bản nháp chưa được lưu hoặc đã thay đổi. Lưu lại trước khi duyệt.');
    const parsed = parseExamCode(doc.rawText ?? '');
    const selected = options.excludeManual ? parsed.questions.filter(q => !isManualQuestion(q)) : parsed.questions;
    if (!selected.length || selected.some(q => q.issues.some(issue => issue.severity === 'error'))) throw Object.assign(new Error(!selected.length && parsed.questions.length ? 'Đề chỉ có câu tự luận chấm tay. Giữ bản nháp hoặc chủ động chuyển dạng phù hợp; chưa hỗ trợ xuất bản bài thi chấm tay.' : examValidationMessage(selected)), { code: 'INVALID_EXAM' });
    // Quiz citations bind to an immutable source revision, not the mutable editor draft.
    const snapshotId = examId(`${id}:source-revision:${revision}`);
    let snapshot = await tx.document.findFirst({ where: { id: snapshotId, ownerId }, include: { chunks: true } });
    if (!snapshot) snapshot = await tx.document.create({ data: { id: snapshotId, ownerId, title: doc.title, fileType: 'text/plain', size: doc.size, storageKey: `editor-source:${snapshotId}`, status: 'ready', rawText: doc.rawText, chunks: { create: chunkText(doc.rawText ?? '') } }, include: { chunks: true } });
    const sourceId = (doc.original?.metadata as Metadata | null)?.editorDraft?.sourceDocumentId;
    const source = sourceId ? await tx.document.findFirst({ where: { id: sourceId, ownerId }, select: { rawText: true } }) : null;
    const sourceQuestions = parseExamCode(source?.rawText ?? '').questions;
    const identity = randomUUID();
    const questions: FullQuestionDTO[] = [];
    for (const q of selected) {
      // Source quote must be an exact substring of persisted draft text, not invented evidence.
      const candidates = [q.sourceText, q.stem.split('\n')[0], ...q.answerEvidence].map(value => value.trim()).filter(Boolean);
      let reference: { chunkId: string; quote: string } | undefined;
      for (const candidate of candidates) { const chunk = snapshot.chunks.find(chunk => chunk.content.includes(candidate.slice(0, 1000))); if (chunk) { reference = { chunkId: chunk.id, quote: candidate.slice(0, 1000) }; break; } }
      if (!reference) throw Object.assign(new Error(`Câu ${q.number}: chưa ánh xạ được đoạn nguồn. Hãy chuẩn hóa và lưu lại.`), { code: 'INVALID_EXAM' });
      const origin = sourceQuestions.some(original => questionCode(original) === questionCode(q)) ? 'document' as const : 'teacher' as const;
      const common = { explanation: q.explanation || 'Tài liệu/bản soạn chưa kèm lời giải. Giáo viên cần kiểm tra trước khi xuất bản.', difficulty: 'comprehension' as const, topic: q.group.slice(0, 200), answerOrigin: origin, reviewed: false, sourceRefs: [reference] };
      if (q.type === 'boolean') {
        const points = q.points / q.statements.length;
        for (const statement of q.statements) {
          const options = [{ id: examId(`${identity}:${q.id}:${statement.letter}:true`), text: 'Đúng' }, { id: examId(`${identity}:${q.id}:${statement.letter}:false`), text: 'Sai' }];
          questions.push({ ...common, id: examId(`${identity}:${statement.id}`), type: 'boolean', stem: `${q.stem}\n${statement.letter}) ${statement.text}`, options, correctOptionIds: [options[statement.verdict ? 0 : 1].id], acceptedAnswers: [], points });
        }
      } else questions.push({ ...common, id: examId(`${identity}:${q.id}`), type: q.type, stem: q.stem, options: q.options.map(option => ({ id: examId(`${identity}:${option.id}`), text: option.text })), correctOptionIds: q.correctOptionIds.map(optionId => examId(`${identity}:${optionId}`)), acceptedAnswers: q.acceptedAnswers, points: q.points });
    }
    if (questions.length > 100) throw Object.assign(new Error('Tối đa 100 mục chấm mỗi đề, tính cả từng ý đúng–sai.'), { code: 'INVALID_EXAM' });
    QuestionListSchema.parse(questions);
    return { documentId: snapshot.id, questions, excludedManualCount: parsed.questions.length - selected.length };
  });
}