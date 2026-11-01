import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readDocxAnswerMarks, validateDocxArchive } from '../apps/web/src/server/document-answer-marks';
import { parseExamCode } from '../apps/web/src/lib/exam-code';
import { extractDocumentContent } from '../apps/web/src/server/extractor';
async function fixture(paragraphs: string[]) {
  const zip = new JSZip(); zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(p => `<w:p>${p}</w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}
const run = (text: string, props = '') => `<w:r><w:rPr>${props}</w:rPr><w:t>${text}</w:t></w:r>`;
describe('DOCX formatting evidence, not arbitrary color guesses', () => {
  it('marks consistently colored whole option but not colored title', async () => {
    const bytes = await fixture([run('PHẦN I. TRẮC NGHIỆM', '<w:color w:val="00AAFF"/>'), run('Câu 1: Nội dung câu hỏi có lớp chữ đủ dài để xác định màu mặc định.'), run('A. Phương án sai màu mặc định'), run('B. Phương án đúng', '<w:color w:val="FF0000"/>')]);
    const result = await readDocxAnswerMarks(bytes, 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Nội dung câu hỏi có lớp chữ đủ dài để xác định màu mặc định.\nA. Phương án sai màu mặc định\nB. Phương án đúng');
    expect(result.evidence).toHaveLength(1); expect(result.evidence[0].confidence).toBe('clear');
    expect(result.rawText).toContain('B. Phương án đúng [Đáp án]');
    expect(parseExamCode(result.rawText).questions[0].correctOptionIds).toHaveLength(1);
  });
  it('recognizes underline on label and treats highlighted or partly underlined text as uncertain', async () => {
    const bytes = await fixture([run('A.', '<w:u w:val="single"/>') + run(' Đáp án được gạch chân nhãn'), run('B. Nội dung nhấn mạnh', '<w:highlight w:val="yellow"/>')]);
    const result = await readDocxAnswerMarks(bytes, 'A. Đáp án được gạch chân nhãn\nB. Nội dung nhấn mạnh');
    expect(result.rawText).toContain('A. Đáp án được gạch chân nhãn [Đáp án]');
    expect(result.rawText).toContain('B. Nội dung nhấn mạnh [Cần xác minh]');
  });
  it('does not auto-apply conflicting colors or a repeated ambiguous option text', async () => {
    const bytes = await fixture([run('Nội dung mặc định rất dài để làm nền nhận diện màu cho tài liệu.'), run('A. Một', '<w:color w:val="FF0000"/>'), run('B. Hai', '<w:color w:val="0000FF"/>')]);
    const result = await readDocxAnswerMarks(bytes, 'A. Một\nB. Hai');
    expect(result.rawText).not.toContain('[Đáp án]'); expect(result.evidence.every(item => item.confidence === 'verify')).toBe(true);
  });
  it('uses inherited run colors and split underlined labels without promoting partial highlight', async () => {
    const zip = new JSZip();
    zip.file('word/styles.xml', '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="AnswerColor"><w:rPr><w:color w:val="CC0000"/></w:rPr></w:style></w:styles>');
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${run('Câu 1: Nội dung mặc định đủ dài để làm nền nhận diện. Không có màu nhấn mạnh.')}</w:p><w:p>${run('A. Lựa chọn', '<w:rStyle w:val="AnswerColor"/>')}</w:p><w:p>${run('B', '<w:u w:val="single"/>')}${run('.', '<w:u w:val="single"/>')}${run(' Lựa chọn khác')}</w:p></w:body></w:document>`);
    const result = await readDocxAnswerMarks(await zip.generateAsync({ type: 'nodebuffer' }), 'Câu 1: Nội dung mặc định đủ dài để làm nền nhận diện. Không có màu nhấn mạnh.\nA. Lựa chọn\nB. Lựa chọn khác');
    expect(result.evidence.map(mark => mark.mark)).toEqual(['color', 'underline']);
    expect(result.rawText.match(/\[Đáp án\]/g)).toHaveLength(2);
  });
  it('rejects untrusted XML entities and oversized expansion before native conversion', async () => {
    const entity = new JSZip(); entity.file('word/document.xml', '<!DOCTYPE data [<!ENTITY x "test">]><data>&x;</data>');
    await expect(validateDocxArchive(await entity.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow('Unsupported DOCX XML');
    const huge = new JSZip(); huge.file('word/document.xml', ' '.repeat(8000001));
    await expect(validateDocxArchive(await huge.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))).rejects.toThrow('safe limit');
  });
  it('does not promote mixed formatting or unresolved theme ink into a verified key', async () => {
    const bytes = await fixture([run('Câu 1: Nội dung mặc định đủ dài để nhận diện nền chữ.'), run('A.', '<w:u w:val="single"/><w:color w:val="FF0000"/>') + run(' Đáp án', '<w:color w:val="FF0000"/>'), run('B. Màu theme', '<w:color w:themeColor="accent1"/>')]);
    const result = await readDocxAnswerMarks(bytes, 'Câu 1: Nội dung mặc định đủ dài để nhận diện nền chữ.\nA. Đáp án\nB. Màu theme');
    expect(result.rawText).not.toContain('[Đáp án]'); expect(result.evidence.every(mark => mark.confidence === 'verify')).toBe(true);
  });
  it('never appends a verified answer to the wrong option in a multi-option paragraph', async () => {
    const bytes = await fixture([run('Câu 1: Chọn phương án đúng từ các lựa chọn dưới đây.'), run('A.', '<w:u w:val="single"/>') + run(' Một lựa chọn B. Lựa chọn khác')]);
    const result = await readDocxAnswerMarks(bytes, 'Câu 1: Chọn phương án đúng từ các lựa chọn dưới đây.\nA. Một lựa chọn B. Lựa chọn khác');
    expect(result.rawText).not.toContain('[Đáp án]');
    expect(result.rawText).toContain('[Cần xác minh]');
    const parsed = parseExamCode(result.rawText);
    expect(parsed.questions[0].correctOptionIds).toHaveLength(0);
    expect(parsed.issues.some(issue => issue.code === 'REQUIRES_REVIEW')).toBe(true);
  });
  it('retains formatting evidence through actual Mammoth DOCX extraction and saved text chunks', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${run('PHẦN I. TRẮC NGHIỆM')}</w:p><w:p>${run('Câu 1: Nội dung câu hỏi mặc định đủ dài và không dùng định dạng nhấn mạnh.')}</w:p><w:p>${run('A. Một lựa chọn')}</w:p><w:p>${run('B. Lựa chọn đúng', '<w:color w:val="CC0000"/>')}</w:p></w:body></w:document>`);
    const result = await extractDocumentContent(await zip.generateAsync({ type: 'nodebuffer' }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'color.docx');
    expect(result.rawText).toContain('B. Lựa chọn đúng [Đáp án]');
    expect(result.answerMarks[0].confidence).toBe('clear');
    expect(result.chunks.some(chunk => chunk.content.includes('[Đáp án]'))).toBe(true);
    expect(parseExamCode(result.rawText).issues).toHaveLength(0);
  });
});