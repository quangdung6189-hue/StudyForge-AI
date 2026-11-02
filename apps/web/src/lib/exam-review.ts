import type { ExamQuestion } from './exam-code';

export const isManualQuestion = (q: ExamQuestion) => q.classification === 'ESSAY' || q.issues.some(issue => ['ESSAY_REQUIRES_MANUAL_GRADING', 'UNSUPPORTED'].includes(issue.code));
export type ExamReviewStatus = 'missing' | 'verify' | 'manual' | 'invalid' | 'ready';
export function questionReview(q: ExamQuestion) {
  const answerPresent = q.type === 'boolean' ? q.statements.length > 0 && q.statements.every(s => s.verdict !== null) : q.type === 'short' || q.type === 'fill' ? q.acceptedAnswers.some(value => value.trim()) : q.correctOptionIds.length > 0;
  const errors = q.issues.filter(issue => issue.severity === 'error');
  const verify = errors.some(issue => !['MISSING_ANSWER', 'INVALID_POINTS', 'EMPTY_STEM', 'ESSAY_REQUIRES_MANUAL_GRADING', 'UNSUPPORTED'].includes(issue.code));
  const manual = isManualQuestion(q);
  const status: ExamReviewStatus = !answerPresent || errors.some(issue => issue.code === 'MISSING_ANSWER') ? 'missing' : verify ? 'verify' : manual ? 'manual' : errors.length ? 'invalid' : 'ready';
  const labels = { missing: 'Thiếu đáp án', verify: 'Cần đối chiếu', manual: 'Tự luận · chấm tay', invalid: 'Lỗi cấu trúc', ready: 'Sẵn sàng duyệt' };
  return { status, label: labels[status], answerPresent, manual, errors };
}
export function examReviewSummary(questions: ExamQuestion[]) {
  const summary = { ready: 0, missing: 0, verify: 0, manual: 0, invalid: 0, answered: 0 };
  for (const q of questions) { const review = questionReview(q); summary[review.status]++; if (review.answerPresent) summary.answered++; }
  return summary;
}
export function examValidationMessage(questions: ExamQuestion[]): string {
  if (!questions.length) return 'Chưa có câu hỏi để duyệt.';
  const summary = examReviewSummary(questions), parts: string[] = [];
  if (summary.missing) parts.push(`${summary.missing} câu thiếu đáp án`);
  if (summary.verify) parts.push(`${summary.verify} câu cần đối chiếu`);
  if (summary.invalid) parts.push(`${summary.invalid} câu lỗi cấu trúc`);
  if (summary.manual) parts.push(`${summary.manual} câu tự luận cần chấm tay, không phải thiếu đáp án`);
  return parts.length ? `Chưa thể duyệt toàn bộ: ${parts.join('; ')}.` : 'Các câu chấm tự động đã đủ dữ liệu. Giáo viên vẫn cần duyệt trước khi xuất bản.';
}

/** Teacher action only. Structural/manual errors remain; formatting never invokes this. */
export function verifyQuestionEvidence(q: ExamQuestion): Partial<ExamQuestion> {
  const clean = (value: string) => value.replace(/\[Cần xác minh\]/giu, '').trim();
  return { stem: clean(q.stem), options: q.options.map(option => ({ ...option, text: clean(option.text) })), statements: q.statements.map(statement => ({ ...statement, text: clean(statement.text) })), acceptedAnswers: q.acceptedAnswers.map(clean), explanation: clean(q.explanation), issues: q.issues.filter(issue => !['REQUIRES_REVIEW', 'ANSWER_CONFLICT'].includes(issue.code)) };
}