import { describe, expect, it } from 'vitest';
import { parseExamCode, normalizeExamCode } from '../apps/web/src/lib/exam-code';
import { analyzeDocument } from '../apps/web/src/server/question-sections';
import { parseExamPro } from '../apps/web/src/server/exam-parser-pro';
import { splitQuestionContent } from '../apps/web/src/lib/exam-answer-blocks';

describe('Written/short answer boundaries shared by first-read and reread', () => {
  it.each([
    'Câu 1: Hai cộng hai bằng bao nhiêu? Đáp án: 4. Giải thích: Cộng hai nhóm.',
    'Câu 1: Hai cộng hai bằng bao nhiêu?\nTrả lời\n4.\nGiải thích\nCộng hai nhóm.',
    'Câu 1: Hai cộng hai bằng bao nhiêu?\n**Trả lời:** 4.\n**Giải thích:** Cộng hai nhóm.',
    'Câu 1: Hai cộng hai bằng bao nhiêu?\nĐáp án：4.\nLời giải：Cộng hai nhóm.',
  ])('keeps an existing key/explanation out of the stem: %s', text => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\n' + text;
    const q = parseExamCode(code).questions[0];
    expect(q.type).toBe('short'); expect(q.acceptedAnswers).toEqual(['4.']);
    expect(q.stem).toBe('Hai cộng hai bằng bao nhiêu?');
    expect(q.explanation).toBe('Cộng hai nhóm.');
    const analysis = analyzeDocument(code).questions[0];
    expect(analysis.stem).not.toMatch(/Đáp án|Trả lời|Giải thích|Cộng hai nhóm/);
    expect(analysis.documentAnswer?.acceptedAnswers).toEqual(['4.']);
    expect(code.includes(analysis.documentAnswer!.quote)).toBe(true);
  });
  it('does not turn questions quoted inside a multiline solution into new questions', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nTrả lời:\n4\nLời giải:\nVì sao kết quả bằng bốn?\n1. Gộp hai nhóm.\n2. Đếm lại.\nCâu 2: Tên gọi ngắn?\nĐáp án: Tổng';
    const result = parseExamCode(code);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].stem).toBe('Tính tổng?');
    expect(result.questions[0].explanation).toContain('Vì sao kết quả bằng bốn?');
    expect(analyzeDocument(code).questions).toHaveLength(2);
  });
  it('retains essay subparts while separating its complete multiline answer and explanation', () => {
    const code = 'PHẦN IV. TỰ LUẬN\nCâu 18: Trình bày nguyên nhân.\na) Nêu nguyên nhân.\nb) Đề xuất biện pháp.\nTrả lời:\na) Nguyên nhân do điều kiện ban đầu.\nb) Cần thực hiện hai biện pháp.\nGiải thích:\nDẫn chứng trong tài liệu.';
    const q = parseExamPro(code, 'Essay').questions[0];
    expect(q.type).toBe('ESSAY'); expect(q.question_stem).toContain('b) Đề xuất biện pháp.');
    expect(q.question_stem).not.toContain('Nguyên nhân do');
    expect(q.correct_answer).toBe('a) Nguyên nhân do điều kiện ban đầu.\nb) Cần thực hiện hai biện pháp.');
    expect(q.explanation).toBe('Dẫn chứng trong tài liệu.');
    const unsupported = analyzeDocument(code).unsupported[0];
    expect(unsupported.stem).not.toContain('Nguyên nhân do');
  });
  it('attaches an explicit written answer section instead of counting it as another exam', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nCâu 2: Thủ đô Việt Nam?\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 4\nGiải thích: Hai cộng hai.\nCâu 2: Hà Nội';
    const parsed = parseExamCode(code); expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].acceptedAnswers).toEqual(['4']); expect(parsed.questions[1].acceptedAnswers).toEqual(['Hà Nội']);
    expect(analyzeDocument(code).questions).toHaveLength(2);
    expect(parseExamPro(code, 'Test').questions).toHaveLength(2);
  });
  it('does not treat answer wording as a question boundary and preserves body text mentioning answers', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nThủ đô Việt Nam là gì?\nTrả lời\nHà Nội\nGiải thích\nCó thể trả lời câu hỏi này bằng cách nào?';
    expect(parseExamCode(code).questions).toHaveLength(1);
    expect(analyzeDocument(code).questions).toHaveLength(1);
    expect(splitQuestionContent(['Giải thích hiện tượng sau?', 'Nêu cách trả lời câu hỏi.']).body).toHaveLength(2);
  });
  it('keeps numeric answers/fractions and alternatives through normalization without leaking answer headings', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị?\nTrả lời\n1/2 | 0,5\nGiải thích: Chia hai.';
    const q = parseExamCode(normalizeExamCode(code)).questions[0];
    expect(q.acceptedAnswers).toEqual(['1/2', '0,5']); expect(q.stem).toBe('Giá trị?');
  });
  it('starts a new unnumbered short question after a solution only with explicit answer evidence', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nTổng bằng bao nhiêu?\nTrả lời: 4\nGiải thích:\nCó thể tính thế nào?\nCộng hai nhóm.\nThủ đô là gì?\nĐáp án: Hà Nội';
    expect(parseExamCode(code).questions.map(q => q.acceptedAnswers)).toEqual([['4'], ['Hà Nội']]);
    expect(analyzeDocument(code).questions.map(q => q.documentAnswer?.acceptedAnswers)).toEqual([['4'], ['Hà Nội']]);
  });
  it('recognizes a trailing LỜI GIẢI section without adding duplicate essay questions', () => {
    const code = 'PHẦN IV. TỰ LUẬN\nCâu 18: Giải thích nguyên nhân.\nLỜI GIẢI\nCâu 18: Do điều kiện ban đầu.\nCần thay đổi cách thực hiện.';
    const pro = parseExamPro(code, 'Test');
    expect(pro.questions).toHaveLength(1); expect(pro.questions[0].correct_answer).toContain('Do điều kiện ban đầu.');
    expect(analyzeDocument(code).unsupported).toHaveLength(1);
  });
  it('keeps an exact source quote even when answer labels and text have empty lines between them', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nTrả lời:\n\n4\n\nGiải thích:\nCộng hai nhóm.';
    const q = analyzeDocument(code).questions[0];
    expect(q.documentAnswer?.acceptedAnswers).toEqual(['4']);
    expect(code).toContain(q.documentAnswer!.quote);
    expect(parseExamCode(code).questions[0].answerEvidence.some(quote => code.includes(quote))).toBe(true);
  });
  it('does not attach unscoped final answers to duplicated question numbers in different sections', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nPHẦN IV. TỰ LUẬN\nCâu 1: Trình bày nguyên nhân.\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nCâu 1: Đáp án không rõ thuộc phần nào';
    expect(parseExamCode(code).questions.every(q => q.acceptedAnswers.length === 0)).toBe(true);
    const analysis = analyzeDocument(code);
    expect(analysis.questions.every(q => !q.documentAnswer)).toBe(true);
    expect(analysis.unsupported.every(q => !q.documentAnswer)).toBe(true);
  });
  it.each(['Đáp án - 1/2 | 0,5', '**Trả lời** – 1/2 | 0,5', 'Đáp số: 1/2 | 0,5'])('reads explicit written-answer separators: %s', label => {
    const code = `PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị bằng bao nhiêu?\n${label}\nLời giải - Chia đôi.`;
    const q = parseExamCode(code).questions[0];
    expect(q.stem).toBe('Giá trị bằng bao nhiêu?');
    expect(q.acceptedAnswers).toEqual(['1/2', '0,5']);
    expect(q.explanation).toBe('Chia đôi.');
    expect(analyzeDocument(code).questions[0].documentAnswer?.acceptedAnswers).toEqual(q.acceptedAnswers);
  });
  it('reads a bare final answer heading followed by section headings, including bold Markdown', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\nPHẦN IV. TỰ LUẬN\nBài 2: Trình bày nguyên nhân.\n**ĐÁP ÁN**\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 4\nPHẦN IV. TỰ LUẬN\nBài 2: Do điều kiện ban đầu.';
    const parsed = parseExamCode(code);
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].acceptedAnswers).toEqual(['4']);
    expect(parsed.questions[1].acceptedAnswers).toEqual(['Do điều kiện ban đầu.']);
    const analysis = analyzeDocument(code);
    expect(analysis.questions).toHaveLength(1); expect(analysis.unsupported).toHaveLength(1);
    expect(analysis.unsupported[0].documentAnswer?.acceptedAnswers).toEqual(['Do điều kiện ban đầu.']);
  });
  it.each([
    'Đáp án: 4\nTrả lời: 5',
    'Đáp án: 4\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 5',
    '[Cần xác minh]\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 4',
  ])('keeps conflicting/unverified written answers blocked: %s', tail => {
    const code = `PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tính tổng?\n${tail}`;
    const parsed = parseExamCode(code);
    expect(parsed.questions[0].issues.some(issue => ['ANSWER_CONFLICT', 'REQUIRES_REVIEW'].includes(issue.code))).toBe(true);
    expect(analyzeDocument(code).questions[0].documentAnswer).toBeUndefined();
    expect(parseExamPro(code, 'Conflict').questions[0].correct_answer).toBeNull();
    expect(parseExamPro(normalizeExamCode(code), 'Conflict').questions[0].correct_answer).toBeNull();
  });
  it('preserves essay answer pipes as text and keeps explicit review markers blocking', () => {
    const code = 'PHẦN IV. TỰ LUẬN\nCâu 1: Trình bày thuật toán. [Cần xác minh]\nTrả lời: Dùng toán tử | để ghép điều kiện.\nBước tiếp theo: đối chiếu dữ liệu.';
    const q = parseExamCode(code).questions[0];
    expect(q.acceptedAnswers).toEqual(['Dùng toán tử | để ghép điều kiện.\nBước tiếp theo: đối chiếu dữ liệu.']);
    expect(analyzeDocument(code).unsupported[0].documentAnswer).toBeUndefined();
    expect(parseExamPro(code, 'Review').questions[0].correct_answer).toBeNull();
  });
  it('compares explicit alternatives as sets, not as conflicting answer order', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị?\nĐáp án: 1/2 | 0,5\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 0,5 | 1/2';
    expect(parseExamCode(code).questions[0].issues.some(issue => issue.code === 'ANSWER_CONFLICT')).toBe(false);
    expect(analyzeDocument(code).questions[0].documentAnswer?.acceptedAnswers).toEqual(['1/2', '0,5']);
  });
  it('preserves wrapped short answers and units until an explicit explanation boundary', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tên gọi?\nTrả lời:\nNatri\nclorua\nGiải thích: Tên chất trong nguồn.\nCâu 2: Khối lượng?\nĐáp án: 1/2\nkg';
    const parsed = parseExamCode(code);
    expect(parsed.questions.map(q => q.acceptedAnswers)).toEqual([['Natri\nclorua'], ['1/2\nkg']]);
    expect(parsed.questions[0].explanation).toBe('Tên chất trong nguồn.');
    expect(analyzeDocument(code).questions.map(q => q.documentAnswer?.acceptedAnswers)).toEqual([['Natri\nclorua'], ['1/2\nkg']]);
    expect(parseExamCode(normalizeExamCode(code)).questions.map(q => q.acceptedAnswers)).toEqual(parsed.questions.map(q => q.acceptedAnswers));
  });
  it('does not verify a final key that carries its own source review marker', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Giá trị?\nĐÁP ÁN VÀ HƯỚNG DẪN GIẢI\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1: 4 [Cần xác minh]';
    expect(parseExamCode(code).questions[0].issues.some(issue => issue.code === 'REQUIRES_REVIEW')).toBe(true);
    expect(analyzeDocument(code).questions[0].documentAnswer).toBeUndefined();
    expect(parseExamPro(code, 'Review').questions[0].correct_answer).toBeNull();
  });
  it('does not reuse the answer as a stem when the source question body is missing', () => {
    const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Đáp án: 4';
    const q = parseExamCode(code).questions[0];
    expect(q.stem).toBe(''); expect(q.acceptedAnswers).toEqual(['4']);
    expect(q.issues.some(issue => issue.code === 'EMPTY_STEM')).toBe(true);
    expect(parseExamPro(code, 'Missing').questions[0].correct_answer).toBeNull();
  });
});