import { describe, expect, it } from 'vitest';
import { allocateExamPoints, EXAM_SAMPLE, normalizeExamCode, parseExamCode, readExamImport, replaceExamQuestion } from '../apps/web/src/lib/exam-code';

describe('Shared evidence-based exam parser', () => {
  it('recognizes three formats without title questions or guessed answers', () => {
    const result = parseExamCode(EXAM_SAMPLE);
    expect(result.questions.map(q => q.type)).toEqual(['single', 'boolean', 'short']);
    expect(result.issues).toHaveLength(0);
    expect(result.questions[0].correctOptionIds).toEqual([result.questions[0].options[1].id]);
    expect(result.questions[1].statements.map(s => s.verdict)).toEqual([true, false]);
    expect(result.questions[2].acceptedAnswers).toEqual(['Hà Nội', 'Ha Noi']);
  });
  it('keeps IDs stable during text and answer edits and keeps section numbering separate', () => {
    const first = parseExamCode(EXAM_SAMPLE).questions;
    const second = parseExamCode(EXAM_SAMPLE.replace('Hai cộng hai', 'Hai cộng ba')).questions;
    expect(second.map(q => q.id)).toEqual(first.map(q => q.id));
    expect(new Set(first.map(q => q.id)).size).toBe(3);
  });
  it('preserves each true/false verdict through normalization, including all-false questions', () => {
    const code = 'PHẦN II. ĐÚNG – SAI\nCâu 1: Xét nhận định\na) Một ý sai\nb) Ý cũng sai\nĐáp án: a - S, b - S';
    const parsed = parseExamCode(normalizeExamCode(code));
    expect(parsed.questions[0].statements.map(s => s.verdict)).toEqual([false, false]);
    expect(parsed.issues).toHaveLength(0);
  });
  it('does not assume unmarked statements false or default choice A', () => {
    const result = parseExamCode('Câu 1: Chọn đáp án\nA. Một\nB. Hai\nPHẦN II. ĐÚNG – SAI\nCâu 1: Xét\na) Một\nb) Hai\nĐáp án: a - Đ');
    expect(result.questions[0].correctOptionIds).toEqual([]);
    expect(result.questions[1].statements[1].verdict).toBeNull();
    expect(result.issues.filter(i => i.code === 'MISSING_ANSWER')).toHaveLength(2);
  });
  it('flags contradictory answer evidence and does not consume math stars or footnotes as keys', () => {
    const result = parseExamCode('Câu 1: Tính 2 * 3\nA. 5\n*B. 6\nĐáp án: A');
    expect(result.issues.some(issue => issue.code === 'ANSWER_CONFLICT')).toBe(true);
    expect(parseExamCode('Câu 1: Tính\nA. 2 * 3\nB. 4\n* Chú thích').questions[0].correctOptionIds).toHaveLength(0);
  });
  it('allocates exactly 10 across repeated question numbers and retains section headings on delete', () => {
    const result = parseExamCode(allocateExamPoints(EXAM_SAMPLE));
    expect(result.questions.reduce((sum, q) => sum + q.points, 0)).toBe(10);
    expect(result.questions.every(q => q.points > 3)).toBe(true);
    const removed = replaceExamQuestion(EXAM_SAMPLE, parseExamCode(EXAM_SAMPLE).questions[0], null);
    expect(removed).toContain('PHẦN II. ĐÚNG – SAI');
    expect(parseExamCode(removed).questions).toHaveLength(2);
  });
  it('supports end-of-exam answer tables without parsing the key as questions', () => {
    const result = parseExamCode('PHẦN I. TRẮC NGHIỆM\nCâu 1: Chọn\nA. Một\nB. Hai\nHẾT\nBẢNG ĐÁP ÁN\nCâu\t1\nChọn\tB');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correctOptionIds).toEqual([result.questions[0].options[1].id]);
  });
  it('retains point values, explanations and accepted answer alternatives on format roundtrip', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: [2.5đ] Thủ đô?\nĐáp án: Hà Nội | Ha Noi\nLời giải: Theo tài liệu gốc.';
    const q = parseExamCode(normalizeExamCode(code)).questions[0];
    expect(q.points).toBe(2.5); expect(q.explanation).toBe('Theo tài liệu gốc.'); expect(q.acceptedAnswers).toHaveLength(2);
  });
  it('preserves preamble and teacher instructions instead of silently discarding them when normalizing', () => {
    const code = 'TRƯỜNG THPT\nThời gian làm bài 45 phút. Không được dùng tài liệu.\n' + EXAM_SAMPLE;
    expect(normalizeExamCode(code)).toContain('Thời gian làm bài 45 phút. Không được dùng tài liệu.');
  });
  it('reports missing option labels and duplicated true/false statement labels', () => {
    expect(parseExamCode('Câu 1: Chọn\nA. Một\nC. Hai\nĐáp án: C').issues.some(issue => issue.code === 'OPTION_SEQUENCE')).toBe(true);
    expect(parseExamCode('PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một\na) Hai\nĐáp án: a - Đ').issues.some(issue => issue.code === 'DUPLICATE_STATEMENT')).toBe(true);
  });
  it('honors an explicit multiple type under a single-choice section and checkbox imports', () => {
    const value = parseExamCode('PHẦN I. TRẮC NGHIỆM\nCâu 1: [type:multiple] Chọn các số\nA. 2\nB. 3\nĐáp án: A, B');
    expect(value.questions[0].type).toBe('multiple'); expect(value.issues).toHaveLength(0);
    const checkboxes = parseExamCode('Câu 1: Chọn\n[x] Một\n[ ] Hai\n[x] Ba');
    expect(checkboxes.questions[0].type).toBe('multiple'); expect(checkboxes.questions[0].correctOptionIds).toHaveLength(2);
  });
  it('does not ignore invalid verdict fragments or answers for nonexistent statements', () => {
    for (const answer of ['a - Đ, b - X', 'a - Đ, c - S']) {
      expect(parseExamCode(`PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một\nb) Hai\nĐáp án: ${answer}`).issues.some(issue => issue.code === 'INVALID_BOOLEAN')).toBe(true);
    }
  });
  it('flags a true/false inline mark that contradicts the explicit verdict', () => {
    expect(parseExamCode('PHẦN II. ĐÚNG SAI\nCâu 1: Xét\n*a) Nhận định sai. SAI').issues.some(issue => issue.code === 'ANSWER_CONFLICT')).toBe(true);
  });
  it('never repairs invalid answer evidence merely by formatting or allocating points', () => {
    const code = 'PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một\nb) Hai\nĐáp án: a - Đ, b - X';
    expect(normalizeExamCode(code)).toContain('b - X');
    expect(allocateExamPoints(code)).toContain('b - X');
    expect(parseExamCode(allocateExamPoints(code)).issues.some(issue => issue.code === 'INVALID_BOOLEAN')).toBe(true);
  });
  it('validates versioned imports and preserves title/time along with text', () => {
    expect(readExamImport(JSON.stringify({ format: 'studyforge.exam.v1', code: EXAM_SAMPLE, title: 'Nhập lại', minutes: 45 }))).toEqual({ code: EXAM_SAMPLE, title: 'Nhập lại', minutes: 45 });
    expect(() => readExamImport('{broken')).toThrow('JSON');
    expect(() => readExamImport(JSON.stringify({ format: 'studyforge.exam.v1', code: EXAM_SAMPLE, minutes: 0 }))).toThrow('Thời gian');
    expect(readExamImport(EXAM_SAMPLE).code).toBe(EXAM_SAMPLE);
  });
  it('keeps blocking verification after visual point/stem edits serialize malformed answer fragments', () => {
    const code = 'PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một\nb) Hai\nĐáp án: a - Đ, b - S, c - X';
    const original = parseExamCode(code).questions[0];
    expect(original.issues.some(issue => issue.code === 'INVALID_BOOLEAN')).toBe(true);
    for (const patch of [{ points: 2 }, { stem: 'Nội dung vừa sửa' }]) {
      const updated = parseExamCode(replaceExamQuestion(code, original, patch));
      expect(updated.issues.some(issue => issue.severity === 'error')).toBe(true);
      expect(updated.issues.some(issue => issue.code === 'REQUIRES_REVIEW')).toBe(true);
    }
    const conflicting = 'Câu 1: [type:short] Chọn\nA. Một\nB. Hai\nĐáp án: Một';
    const q = parseExamCode(conflicting).questions[0];
    expect(parseExamCode(replaceExamQuestion(conflicting, q, { points: 3 })).issues.some(issue => issue.code === 'REQUIRES_REVIEW')).toBe(true);
  });
});