import { randomUUID } from 'node:crypto';
import { QuestionListSchema, type FullQuestionDTO, type QuestionType } from '@studyforge/contracts';
import { assertCitations } from '@studyforge/core';
import { detectSourceQuestions, selectSourceQuestions } from './question-sections';

/** A deterministic third creation mode: no model call and no guessed answer keys. */
export function sourceQuiz(input: { rawText?: string | null; chunks: { id: string; content: string }[]; questionCount: number; types: QuestionType[]; documentTitle: string }): FullQuestionDTO[] {
  const candidates = detectSourceQuestions(input.rawText ?? input.chunks.map(c => c.content).join('\n')).filter(q => q.documentAnswer && input.chunks.some(c => c.content.includes(q.documentAnswer!.quote)));
  const selected = selectSourceQuestions(candidates, input.types, input.questionCount);
  const questions = selected.map(q => {
    const answer = q.documentAnswer!, chunk = input.chunks.find(c => c.content.includes(answer.quote))!;
    const options = q.options.map(text => ({ id: randomUUID(), text }));
    const value = answer.acceptedAnswers.join(' / ') || answer.indices.map(i => q.options[i]).join(' / ');
    const explanation = q.sourceExplanation ? `Đáp án gốc: ${value}.\n\nLời giải trong tài liệu:\n${q.sourceExplanation}` : `Đáp án gốc: ${value}.\n\nTài liệu chưa kèm lời giải cho câu này. Hãy kiểm tra bản gốc hoặc bổ sung lời giải khi duyệt đề.`;
    return { id: randomUUID(), type: q.type, stem: q.stem, options, correctOptionIds: answer.indices.map(i => options[i].id), acceptedAnswers: answer.acceptedAnswers, explanation: [explanation, ...(q.warnings ?? [])].join('\n\n'), points: 1, difficulty: 'comprehension' as const, topic: input.documentTitle.slice(0, 200), answerOrigin: 'document' as const, reviewed: false, sourceRefs: [{ chunkId: chunk.id, quote: answer.quote }] };
  });
  if (!questions.length) throw Object.assign(new Error('Chưa có câu hỏi với đáp án gốc xác thực thuộc dạng đã chọn. Hãy kiểm tra bản gốc hoặc dùng chế độ AI để bổ sung.'), { code: 'NO_SOURCE_ANSWERS' });
  QuestionListSchema.parse(questions); assertCitations(questions, input.chunks); return questions;
}
