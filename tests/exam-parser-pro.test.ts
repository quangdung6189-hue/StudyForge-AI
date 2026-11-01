import { describe, expect, it } from 'vitest';
import { parseExamCode, normalizeExamCode } from '../apps/web/src/lib/exam-code';
import { unglueExamText } from '../apps/web/src/lib/exam-layout';
import { analyzeDocument } from '../apps/web/src/server/question-sections';
import { parseExamPro, ExamParserProSchema } from '../apps/web/src/server/exam-parser-pro';
import { documentHtmlToText } from '../apps/web/src/server/document-html';
import { extractDocumentContent } from '../apps/web/src/server/extractor';
import JSZip from 'jszip';

describe('Exam-Parser-Pro bottom-up classification and conservative repairs', () => {
  it.each([
    ['PHẦN II. ĐÚNG SAI', 'Ghép các mục tương ứng:\n1 - Vật thứ nhất\na) Nội dung cột bên phải\nb) Nội dung khác', 'A. 1-b; 2-a\nB. 1-a; 2-b\nC. 1-c; 2-a\nD. 1-d; 2-b'],
    ['PHẦN III. TRẢ LỜI NGẮN', 'Điền vào chỗ (...): giá trị đúng là', 'A. 1\nB. 2\nC. 3\nD. 4'],
    ['PHẦN I. TRẮC NGHIỆM', 'Trong các phát biểu dưới đây, phát biểu nào đúng/sai?\na) Nhận định một\nb) Nhận định hai', 'A. 1, 2\nB. 2, 3\nC. 1, 3\nD. 1, 4'],
  ])('lets terminal A–D override misleading heading/stem: %s', (section, stem, choices) => {
    const code = `${section}\nCâu 1: ${stem}\n${choices}\nĐáp án: B`;
    const result = parseExamCode(code);
    expect(result.questions).toHaveLength(1); expect(result.questions[0].type).toBe('single');
    expect(result.questions[0].options).toHaveLength(4); expect(result.questions[0].stem).toContain(stem);
    expect(result.questions[0].statements).toHaveLength(0);
    const analysis = analyzeDocument(code);
    expect(analysis.questions).toHaveLength(1); expect(analysis.questions[0].type).toBe('single');
    expect(analysis.questions[0].options).toHaveLength(4);
  });
  it('splits glued boundaries/options without changing numerical payloads or duplicate source numbering', () => {
    const raw = 'PHẦN I. TRẮC NGHIỆM\nCâu 9: Chọn\nA. Cánh quạt điệnB. Quyển sáchC. 10/10D. 15/0\nĐáp án: B\nCâu 9: Tính khối lượng là bao nhiêu?';
    const repaired = unglueExamText(raw);
    expect(repaired.text).toContain('điện\nB.'); expect(repaired.text).toContain('C. 10/10\nD. 15/0');
    const parsed = parseExamCode(raw); expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions.map(q => q.number)).toEqual([9, 9]);
    expect(parsed.issues.some(issue => issue.code === 'DUPLICATE_NUMBER')).toBe(true);
    const glued = parseExamCode('Câu 1: Chọn\nA. 1\nB. 2\nC. 3\nD. 2,88 g/cm³Câu 10: Tính số phần là bao nhiêu?');
    expect(glued.questions.map(q => q.number)).toEqual([1, 10]);
    expect(glued.questions[0].options[3].text).toBe('2,88 g/cm³');
  });
  it('sorts a PDF two-column A,C,B,D run by explicit labels without moving its answer key', () => {
    const code = 'Câu 1: Chọn\nA. Một\nC. Ba\nB. Hai\nD. Bốn\nĐáp án: C';
    const q = parseExamCode(code).questions[0];
    expect(q.options.map(option => option.text)).toEqual(['Một', 'Hai', 'Ba', 'Bốn']);
    expect(q.correctOptionIds).toEqual([q.options[2].id]);
    expect(parseExamCode(normalizeExamCode(code)).questions[0].options.map(o => o.letter)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('recovers missing labels only as a verification-required suggestion', () => {
    for (const code of ['Câu 1: Chọn\nMột\nB. Hai\nC. Ba\nD. Bốn\nĐáp án: A', 'PHẦN I. TRẮC NGHIỆM KHÁCH QUAN\nCâu 1: Chọn đối tượng\nMột\nHai\nBa\nBốn\nĐáp án: A']) {
      const q = parseExamCode(code).questions[0]; expect(q.options).toHaveLength(4);
      expect(q.issues.some(issue => issue.severity === 'error')).toBe(true);
      expect(parseExamPro(code, 'Test').questions[0].correct_answer).toBeNull();
    }
  });
  it('separates unnumbered short questions and recognizes essay without silently auto-grading it', () => {
    const code = 'Môn: Vật lí\nLớp 8\nPHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN\nCơ thể người gồm mấy phần?\nKhối lượng riêng là bao nhiêu g/cm³?\nPHẦN IV. TỰ LUẬN\nCâu 18: Trình bày nguyên nhân và nêu biện pháp.\na) Giải thích bước một.\nb) Viết công thức và giải thích đại lượng.';
    const parsed = parseExamPro(code, 'Đề cương');
    expect(parsed.questions.map(q => q.type)).toEqual(['SHORT_ANSWER', 'SHORT_ANSWER', 'ESSAY']);
    expect(parsed.exam_metadata).toMatchObject({ grade: 8, subject: 'Vật lí', total_questions: 3 });
    expect(parsed.questions[2].question_stem).toContain('a) Giải thích');
    expect(parsed.questions[0].original_number).toBeNull();
    expect(parsed.questions[1].original_number).toBeNull();
    expect(parsed.questions[2].original_number).toBe('Câu 18');
    expect(parsed.questions.every(q => q.answer_source === null && q.correct_answer === null)).toBe(true);
    expect(ExamParserProSchema.safeParse(parsed).success).toBe(true);
  });
  it('supports a single true/false question without assuming a missing verdict false', () => {
    const unknown = parseExamPro('PHẦN II. ĐÚNG SAI\nCâu 1: Thỏi thép chịu lực đẩy lớn hơn?', 'Test');
    expect(unknown.questions[0].type).toBe('TRUE_FALSE');
    expect(unknown.questions[0].sub_statements[0].is_true).toBeNull();
    const known = parseExamPro('PHẦN II. ĐÚNG SAI\nCâu 1: Hai cộng hai bằng năm?\nĐáp án: Sai', 'Test');
    expect(known.questions[0].sub_statements[0].is_true).toBe(false);
    const grouped = 'PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một nhận định\nb) Nhận định khác\nĐáp án: a - Đ, b - S';
    expect(analyzeDocument(grouped).questions.map(q => q.documentAnswer?.indices[0] ?? null)).toEqual([0, 1]);
  });
  it('reads checked verdict columns only with an explicit ĐÚNG/SAI table header', () => {
    const code = 'PHẦN II. ĐÚNG SAI\nCâu 1: Xét nhận định\nNhận định\tĐÚNG\tSAI\n1. Một\tX\t\n2. Hai\t\tX\n3. Ba\t\t';
    const q = parseExamCode(code).questions[0];
    expect(q.type).toBe('boolean'); expect(q.statements.map(statement => statement.verdict)).toEqual([true, false, null]);
    const known = parseExamCode('PHẦN II. ĐÚNG SAI\nCâu 1: Xét\na) Một nhận định. SAI X');
    expect(known.questions[0].statements[0].verdict).toBe(false);
    expect(known.questions[0].statements[0].text).not.toContain('SAI X');
    const contradictory = parseExamPro('PHẦN II. ĐÚNG SAI\nCâu 1: Xét\nNhận định\tĐÚNG\tSAI\n1. Một\tX\tX', 'Test');
    expect(contradictory.questions[0].correct_answer).toBeNull();
    const partial = parseExamPro(code, 'Test');
    expect(partial.questions[0].sub_statements.map(statement => statement.is_true)).toEqual([true, false, null]);
    expect(partial.questions[0].correct_answer).toBeNull();
  });
  it('flags OCR numbers rather than silently inventing a missing digit', () => {
    const code = 'Câu 1: Chọn\nA. 1\nB. 2\n10/10\nD15/0\nĐáp án: B';
    const q = parseExamCode(code).questions[0];
    expect(q.sourceText).toContain('D15/0');
    expect(q.issues.some(issue => issue.code === 'OCR_OPTION_LABEL_UNRESOLVED')).toBe(true);
    expect(parseExamPro(code, 'Test').questions[0].correct_answer).toBeNull();
  });
  it('retains table cell positions from converted Word HTML all the way to verdicts', () => {
    const html = '<h2>PHẦN II. ĐÚNG SAI</h2><p>Câu 1: Xét</p><table><tr><td>Nhận định</td><td>ĐÚNG</td><td>SAI</td></tr><tr><td>1. Một</td><td>X</td><td></td></tr><tr><td>2. Hai</td><td></td><td>X</td></tr><tr><td>3. Ba</td><td></td><td></td></tr></table>';
    const text = documentHtmlToText(html).text;
    expect(text).toContain('1. Một\tX\t'); expect(text).toContain('2. Hai\t\tX');
    expect(parseExamCode(text).questions[0].statements.map(statement => statement.verdict)).toEqual([true, false, null]);
    const analysis = analyzeDocument(text);
    expect(analysis.questions.map(question => question.documentAnswer?.indices[0] ?? null)).toEqual([0, 1, null]);
    expect(analysis.questions.filter(question => question.documentAnswer).every(question => text.includes(question.documentAnswer!.quote))).toBe(true);
  });
  it('does not split ordinary references to a numbered question in running prose', () => {
    const code = 'Câu 1: Dựa theo Câu 2: trong ví dụ, chọn kết quả.\nA. Một\nB. Hai\nC. Ba\nD. Bốn\nĐáp án: A';
    expect(parseExamCode(code).questions).toHaveLength(1);
    expect(parseExamCode(code).questions[0].stem).toContain('Dựa theo Câu 2:');
  });
  it('preserves final empty verdict cells through real DOCX extraction', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const p = (value: string) => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`;
    const row = (cells: string[]) => `<w:tr>${cells.map(value => `<w:tc>${p(value)}</w:tc>`).join('')}</w:tr>`;
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('PHẦN II. ĐÚNG SAI')}${p('Câu 1: Xét các nhận định')}<w:tbl>${row(['Nhận định', 'ĐÚNG', 'SAI'])}${row(['1. Một nhận định', '', 'X'])}${row(['2. Nhận định khác', 'X', ''])}</w:tbl></w:body></w:document>`);
    const result = await extractDocumentContent(await zip.generateAsync({ type: 'nodebuffer' }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'verdict-table.docx');
    expect(parseExamCode(result.rawText).questions[0].statements.map(statement => statement.verdict)).toEqual([false, true]);
    expect(analyzeDocument(result.rawText).questions.map(q => q.documentAnswer?.indices[0] ?? null)).toEqual([1, 0]);
  });
});