import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../apps/web/src/server/question-sections';
import { documentHtmlToText } from '../apps/web/src/server/document-html';
import { extractDocumentContent } from '../apps/web/src/server/extractor';

describe('Faithful mixed-format document reading', () => {
  it('recognizes Roman headings, uppercase true/false, inline answer marks, wrapped verdicts, and excludes references', () => {
    const text = `I. TRẮC NGHIỆM CHỌN MỘT ĐÁP ÁN
Câu 1. Chọn kết quả đúng.
A. 3
B. 4 [Đáp án]
Câu 2. Câu có ghi chú.
A. Một [Đáp án*]
B. Hai
* Cần đối chiếu giáo viên.
BẢNG ĐÁP ÁN NHANH - CÂU 1 ĐẾN 2
Câu 1 2
Đáp án B A*
ĐỐI CHIẾU RIÊNG
1. Tài liệu tham khảo thứ nhất.
2. Tài liệu tham khảo thứ hai.
\fLỊCH SỬ 8 • ĐÁP ÁN THAM KHẢO Trang 2
II. TRẮC NGHIỆM ĐÚNG/SAI
Câu 3. Đọc dữ kiện: 2 + 2 = 4.
A. Kết quả bằng bốn. ĐÚNG
B. Kết quả bằng năm.
SAI
Giải thích ngắn: Phép cộng hai nhóm, mỗi nhóm hai phần tử, cho tổng bốn phần tử; phát biểu kết quả bằng năm không phù hợp.
III. TRẢ LỜI NGẮN
Câu 1. Tính 2 + 2.
Đáp án: 4`;
    const result = analyzeDocument(text);
    expect(result.counts).toEqual({ single: 2, multiple: 0, boolean: 2, short: 1, fill: 0 });
    expect(result.sourceGroups).toBe(4);
    expect(result.questions[0].options).toEqual(['3','4']);
    expect(result.questions[0].documentAnswer?.indices).toEqual([1]);
    expect(result.questions[1].warnings?.length).toBe(1);
    expect(result.questions[1].options[1]).toBe('Hai');
    expect(result.questions[2].documentAnswer?.indices).toEqual([0]);
    expect(result.questions[3].documentAnswer?.indices).toEqual([1]);
    expect(result.questions[3].pageNumber).toBe(2);
    expect(result.questions[3].sourceExplanation).toContain('bốn phần tử');
    expect(result.questions[4].documentAnswer?.acceptedAnswers).toEqual(['4']);
    expect(result.questions.some(q => /Tài liệu tham khảo/.test(q.stem))).toBe(false);
  });
  it('keeps matching, ordering and essay questions for review instead of misclassifying them as short answers', () => {
    const result = analyzeDocument('PHẦN IV. Ghép đôi\nCâu 1. Ghép nhân vật và sự kiện.\nA. Nhân vật một.\nB. Nhân vật hai.\nPHẦN V. Tự luận\nCâu 2. Phân tích ý nghĩa của cuộc cách mạng.');
    expect(result.questions).toHaveLength(0); expect(result.unsupported).toHaveLength(2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('maps explicit answer grids within their section without incorporating them into options', () => {
    const result = analyzeDocument('I. Trắc nghiệm\nCâu 1. Chọn một.\nA. Sai\nB. Đúng\nBẢNG ĐÁP ÁN\nCâu\t1\nĐáp án\tB');
    expect(result.questions[0].options).toEqual(['Sai','Đúng']);
    expect(result.questions[0].documentAnswer?.indices).toEqual([1]);
    expect(result.questions[0].documentAnswer?.quote).toContain('Đáp án\tB');
    const spaced = analyzeDocument('I. Trắc nghiệm\nCâu 1. Chọn một.\nA. Không\nB. Có [Đáp án]\n\nCâu\t1\n\nĐáp án\tB');
    expect(spaced.questions[0].options).toEqual(['Không','Có']);
  });
  it('preserves document lists, table cell boundaries, formulas, and flags images without inventing their content', () => {
    const result = documentHtmlToText('<h1>PHẦN I. Trắc nghiệm</h1><ol><li><p>Tính hai cộng hai.</p><ol><li>3</li><li>4 [Đáp án]</li></ol></li></ol><table><tr><td>Câu</td><td>1</td></tr><tr><td>Đáp án</td><td>B</td></tr></table><p>x<sup>2</sup> và H<sub>2</sub>O</p><img src="private"/>');
    expect(result.text).toContain('Câu 1. Tính'); expect(result.text).toContain('A. 3'); expect(result.text).toContain('B. 4 [Đáp án]');
    expect(result.text).toContain('Câu\t1'); expect(result.text).toContain('x^(2)'); expect(result.text).toContain('H_(2)O');
    expect(result.hasImages).toBe(true); expect(result.text).not.toContain('private');
  });
  it('reads UTF-16 and decomposed Vietnamese without losing accents', async () => {
    const text = 'PHẦN III. Trả lời ngắn\nCâu 1. Tính tổng hai số.';
    const output = await extractDocumentContent(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text.normalize('NFD'),'utf16le')]), 'text/plain', 'sample.txt');
    expect(output.rawText).toBe(text); expect(output.needsOcr).toBe(false);
  });
  it('does not pretend an unread image has text or ready status', async () => {
    const output = await extractDocumentContent(Buffer.from('placeholder-image'), 'image/png', 'sample.png');
    expect(output.rawText).toBe(''); expect(output.needsOcr).toBe(true); expect(output.chunks).toHaveLength(0);
  });
});
