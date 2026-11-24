import { answerCredit, decodeAnswers, transientId } from '@studyforge/core';
import type { QuizSnapshot } from '@studyforge/contracts';

export const isPracticeQuiz = (description: string | null | undefined, snapshot?: QuizSnapshot) =>
  Boolean(description?.includes('[mode:practice]') || snapshot?.description?.includes('[mode:practice]'));

/**
 * Feedback for one checked practice answer, expressed in the attempt's transient ids.
 * Only ever called for practice-mode quizzes; exams never reveal keys before submission.
 */
export function practiceFeedback(snapshot: QuizSnapshot, seed: string, transientQuestionId: string, values: string[]) {
  const question = snapshot.questions.find(q => transientId(seed, q.id) === transientQuestionId);
  if (!question) throw Object.assign(new Error('Câu hỏi không thuộc lượt làm bài này'), { code: 'NOT_FOUND' });
  const decoded = decodeAnswers(snapshot, seed, { [transientQuestionId]: values })[question.id] ?? [];
  const credit = answerCredit(question, decoded);
  return {
    questionId: transientQuestionId,
    correct: credit === 1,
    credit,
    earnedPoints: Math.round(question.points * credit * 1e6) / 1e6,
    points: question.points,
    correctOptionIds: question.correctOptionIds.map(id => transientId(seed, id)),
    acceptedAnswers: question.acceptedAnswers,
    pairs: question.pairs?.map(p => ({ leftId: transientId(seed, p.leftId), rightId: transientId(seed, p.rightId) })),
    explanation: question.explanation,
    sourceRefs: question.sourceRefs.map(ref => ({ quote: ref.quote })),
  };
}
export type PracticeFeedback = ReturnType<typeof practiceFeedback>;
