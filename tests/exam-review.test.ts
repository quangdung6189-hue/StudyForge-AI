import { describe, expect, it } from 'vitest';
import { normalizeExamCode, parseExamCode, replaceExamQuestion } from '../apps/web/src/lib/exam-code';
import { examReviewSummary, questionReview, verifyQuestionEvidence } from '../apps/web/src/lib/exam-review';

const essay = 'PHẦN II. TỰ LUẬN\nCâu 4: Trình bày nhược điểm của thế hệ máy tính đầu tiên.\nTrả lời:\n- Máy tính rất lớn.\n- Máy tính đắt tiền.\n- Tiêu thụ nhiều điện.';
describe('Truthful written-answer review and explicit grading modes', () => {
  it('does not call an answered essay missing or manufacture review markers during visual edits', () => {
    const q = parseExamCode(essay).questions[0];
    expect(q.acceptedAnswers[0]).toContain('Máy tính rất lớn.');
    expect(questionReview(q)).toMatchObject({ answerPresent: true, status: 'manual', label: 'Tự luận · chấm tay' });
    const edited = replaceExamQuestion(essay, q, { points: 2 });
    expect(edited).not.toContain('[Cần xác minh]');
    expect(parseExamCode(edited).questions[0].classification).toBe('ESSAY');
    expect(parseExamCode(normalizeExamCode(essay)).questions[0].acceptedAnswers).toEqual(q.acceptedAnswers);
    expect(examReviewSummary([q])).toMatchObject({ missing: 0, manual: 1, ready: 0 });
  });
  it('honors an explicit teacher short-answer type under an essay section and imperative stem', () => {
    const code = 'PHẦN II. TỰ LUẬN\nCâu 4: [type:short] Trình bày tên gọi ngắn.\nĐáp án: ENIAC';
    const q = parseExamCode(code).questions[0];
    expect(q.classification).toBeUndefined();
    expect(q.issues).toEqual([]); expect(questionReview(q).status).toBe('ready');
    expect(parseExamCode(normalizeExamCode(code)).questions[0].issues).toEqual([]);
  });
  it('keeps essay pipes/subparts on roundtrip and distinguishes actual verification from manual grading', () => {
    const code = 'PHẦN II. TỰ LUẬN\nCâu 4: Phân tích toán tử. [Cần xác minh]\nTrả lời: a) Dùng | để ghép.\nb) Đối chiếu.';
    const q = parseExamCode(code).questions[0];
    expect(questionReview(q)).toMatchObject({ status: 'verify', answerPresent: true });
    const next = replaceExamQuestion(code, q, verifyQuestionEvidence(q));
    const checked = parseExamCode(next).questions[0];
    expect(checked.stem).not.toContain('[Cần xác minh]');
    expect(checked.classification).toBe('ESSAY');
    expect(questionReview(checked).status).toBe('manual');
    expect(checked.acceptedAnswers).toEqual(['a) Dùng | để ghép.\nb) Đối chiếu.']);
  });
  it('keeps explicit essay classification even outside essay sections', () => {
    const q = parseExamCode('Câu 1: [type:essay] Nêu tên.\nTrả lời: Máy tính.').questions[0];
    expect(q.classification).toBe('ESSAY'); expect(questionReview(q).status).toBe('manual');
  });
  it('reports separate reasons for missing, contradictory and manual answers', () => {
    const questions = parseExamCode('PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị?\nCâu 2: Tổng?\nĐáp án: 4\nTrả lời: 5\n' + essay).questions;
    expect(examReviewSummary(questions)).toMatchObject({ missing: 1, verify: 1, manual: 1, ready: 0 });
    expect(questionReview(questions[1]).answerPresent).toBe(true);
    expect(questionReview(questions[1]).label).toBe('Cần đối chiếu');
  });
});