import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseExamCode } from '../apps/web/src/lib/exam-code';
import { readDocxAnswerMarks } from '../apps/web/src/server/document-answer-marks';
import { parseExamPro, ExamParserProSchema } from '../apps/web/src/server/exam-parser-pro';
import { analyzeDocument } from '../apps/web/src/server/question-sections';

const runXml = (text: string, props = '') => `<w:r><w:rPr>${props}</w:rPr><w:t>${text}</w:t></w:r>`;
async function makeDocx(paragraphs: string[]) {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(p => `<w:p>${p}</w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Exam Question Recognition & Answer Provenance Upgrade', () => {
  describe('1. Phân loại 4 nhóm câu hỏi: Trắc nghiệm, Đúng/Sai, Chọn nhiều ý đúng, Điền chỗ trống', () => {
    it('nhận diện chính xác câu trắc nghiệm 1 đáp án (MULTIPLE_CHOICE / single)', () => {
      const code = 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Thủ đô của Việt Nam là gì?\nA. Hà Nội\nB. TP. Hồ Chí Minh\nC. Đà Nẵng\nD. Cần Thơ\nĐáp án: A';
      const parsed = parseExamCode(code);
      expect(parsed.questions).toHaveLength(1);
      const q = parsed.questions[0];
      expect(q.type).toBe('single');
      expect(q.hasAnswer).toBe(true);
      expect(q.correctOptionIds).toEqual([q.options[0].id]);

      const pro = parseExamPro(code, 'Test MC');
      expect(pro.questions[0].type).toBe('MULTIPLE_CHOICE');
      expect(pro.questions[0].question_category).toBe('trac_nghiem');
      expect(pro.questions[0].has_answer).toBe(true);
      expect(pro.questions[0].correct_answer).toBe('A');
    });

    it('nhận diện chính xác câu trắc nghiệm chọn nhiều ý đúng (MULTIPLE_SELECT / multiple)', () => {
      // Trường hợp 1: Stem chứa yêu cầu chọn các phát biểu đúng
      const code1 = 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Chọn các phát biểu đúng về kim loại kiềm:\nA. Có nhiệt độ nóng chảy thấp\nB. Khối lượng riêng nhỏ\nC. Độ cứng lớn\nD. Dẫn điện tốt\nĐáp án: A, B, D';
      const parsed1 = parseExamCode(code1);
      expect(parsed1.questions[0].type).toBe('multiple');
      expect(parsed1.questions[0].hasAnswer).toBe(true);
      expect(parsed1.questions[0].correctOptionIds).toHaveLength(3);

      const pro1 = parseExamPro(code1, 'Test Multi');
      expect(pro1.questions[0].type).toBe('MULTIPLE_SELECT');
      expect(pro1.questions[0].question_category).toBe('chon_nhieu_y_dung');
      expect(pro1.questions[0].correct_answer).toBe('A, B, D');

      // Trường hợp 2: Section header ghi rõ trắc nghiệm nhiều đáp án
      const code2 = 'PHẦN II. TRẮC NGHIỆM NHIỀU ĐÁP ÁN ĐÚNG\nCâu 2: Các hiện tượng vật lí là:\n*A. Nước đá tan\nB. Sắt bị gỉ sét\n*C. Cồn bay hơi\nD. Đốt cháy than';
      const parsed2 = parseExamCode(code2);
      expect(parsed2.questions[0].type).toBe('multiple');
      expect(parsed2.questions[0].hasAnswer).toBe(true);
      expect(parsed2.questions[0].options.filter(o => parsed2.questions[0].correctOptionIds.includes(o.id)).map(o => o.letter)).toEqual(['A', 'C']);
    });

    it('nhận diện chính xác câu đúng – sai (TRUE_FALSE / boolean) với từng nhận định a, b, c, d', () => {
      const code = 'PHẦN II. ĐÚNG SAI\nCâu 1: Cho hàm số f(x) liên tục trên R.\na) Hàm số luôn đồng biến trên R. ĐÚNG\nb) Đồ thị cắt trục tung tại gốc tọa độ. SAI\nc) Giá trị nhỏ nhất bằng 0.\nd) Đạo hàm cấp 1 luôn dương. ĐÚNG';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('boolean');
      expect(parsed.questions[0].statements).toHaveLength(4);
      expect(parsed.questions[0].statements.map(s => s.verdict)).toEqual([true, false, null, true]);
      expect(parsed.questions[0].hasAnswer).toBe(true);

      const pro = parseExamPro(code, 'Test TF');
      expect(pro.questions[0].type).toBe('TRUE_FALSE');
      expect(pro.questions[0].question_category).toBe('dung_sai');
      // Vì ý c chưa có đáp án, overall correct_answer là null (cần giáo viên duyệt)
      expect(pro.questions[0].correct_answer).toBeNull();
      expect(pro.questions[0].sub_statements.map(s => s.is_true)).toEqual([true, false, null, true]);
    });

    it('nhận diện chính xác câu trả lời điền chỗ trống (FILL_IN_BLANK / fill)', () => {
      const code = 'PHẦN III. ĐIỀN TỪ VÀO CHỖ TRỐNG\nCâu 1: Quang hợp ở thực vật chủ yếu diễn ra tại bào quan _____ trong tế bào lá.\nĐáp án: lục lạp';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('fill');
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].acceptedAnswers).toEqual(['lục lạp']);

      const pro = parseExamPro(code, 'Test Fill');
      expect(pro.questions[0].type).toBe('FILL_IN_BLANK');
      expect(pro.questions[0].question_category).toBe('dien_cho_trong');
      expect(pro.questions[0].correct_answer).toBe('lục lạp');
    });

    it('nhận diện chính xác câu trả lời ngắn (SHORT_ANSWER / short)', () => {
      const code = 'PHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN\nCâu 1: Trong mặt phẳng Oxy, khoảng cách từ gốc tọa độ đến điểm A(3, 4) bằng bao nhiêu?\nĐáp án: 5';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('short');
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].acceptedAnswers).toEqual(['5']);

      const pro = parseExamPro(code, 'Test Short');
      expect(pro.questions[0].type).toBe('SHORT_ANSWER');
      expect(pro.questions[0].question_category).toBe('tra_loi_ngan');
      expect(pro.questions[0].correct_answer).toBe('5');
    });
  });

  describe('2. Nhận diện câu hỏi CÓ ĐÁP ÁN vs KHÔNG CÓ ĐÁP ÁN', () => {
    it('xác định rõ ràng câu KHÔNG CÓ đáp án: hasAnswer = false, correct_answer = null, không tự đoán A', () => {
      const code = 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Định luật I Newton còn gọi là định luật gì?\nA. Định luật quán tính\nB. Định luật gia tốc\nC. Định luật tác dụng - phản tác dụng\nD. Định luật vạn vật hấp dẫn\nCâu 2: Số nguyên tố chẵn duy nhất là số nào?\nA. 0\nB. 2\nC. 4\nD. 6';
      const parsed = parseExamCode(code);
      expect(parsed.questions).toHaveLength(2);
      expect(parsed.questions[0].hasAnswer).toBe(false);
      expect(parsed.questions[0].correctOptionIds).toHaveLength(0);
      expect(parsed.questions[0].issues.some(i => i.code === 'MISSING_ANSWER')).toBe(true);

      expect(parsed.questions[1].hasAnswer).toBe(false);
      expect(parsed.questions[1].correctOptionIds).toHaveLength(0);
      expect(parsed.questions[1].issues.some(i => i.code === 'MISSING_ANSWER')).toBe(true);

      const pro = parseExamPro(code, 'Test No Answer');
      expect(pro.questions[0].has_answer).toBe(false);
      expect(pro.questions[0].correct_answer).toBeNull();
      expect(pro.questions[1].has_answer).toBe(false);
      expect(pro.questions[1].correct_answer).toBeNull();
    });

    it('nhận diện đáp án bôi màu highlight hoặc shading trong DOCX', async () => {
      const docx = await makeDocx([
        runXml('PHẦN I. TRẮC NGHIỆM'),
        runXml('Câu 1: Đơn vị của lực trong hệ SI là gì?'),
        runXml('A. Joule'),
        runXml('B. Newton', '<w:highlight w:val="yellow"/>'),
        runXml('C. Pascal'),
        runXml('D. Watt'),
      ]);
      const text = 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Đơn vị của lực trong hệ SI là gì?\nA. Joule\nB. Newton\nC. Pascal\nD. Watt';
      const result = await readDocxAnswerMarks(docx, text);
      expect(result.rawText).toContain('B. Newton [Đáp án]');
      expect(result.evidence[0].mark).toBe('highlight');
      expect(result.evidence[0].confidence).toBe('clear');

      const parsed = parseExamCode(result.rawText);
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].correctOptionIds).toHaveLength(1);
      expect(parsed.questions[0].options.find(o => o.letter === 'B')?.id).toBe(parsed.questions[0].correctOptionIds[0]);
    });

    it('nhận diện đáp án gạch chân dưới chân đáp án (w:u) trong DOCX', async () => {
      const docx = await makeDocx([
        runXml('PHẦN I. TRẮC NGHIỆM'),
        runXml('Câu 1: Công thức hóa học của nước là gì?'),
        runXml('A. H2O', '<w:u w:val="single"/>'),
        runXml('B. CO2'),
        runXml('C. NaCl'),
        runXml('D. O2'),
      ]);
      const text = 'PHẦN I. TRẮC NGHIỆM\nCâu 1: Công thức hóa học của nước là gì?\nA. H2O\nB. CO2\nC. NaCl\nD. O2';
      const result = await readDocxAnswerMarks(docx, text);
      expect(result.rawText).toContain('A. H2O [Đáp án]');
      expect(result.evidence[0].mark).toBe('underline');
      expect(result.evidence[0].confidence).toBe('clear');

      const parsed = parseExamCode(result.rawText);
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].correctOptionIds).toHaveLength(1);
    });

    it('nhận diện đáp án đánh dấu bằng dấu tích ✓, [x], ngôi sao *', () => {
      const code = `
PHẦN I. TRẮC NGHIỆM
Câu 1: Động vật nào đẻ trứng?
A. Cá voi
B. Chuột túi
✓ C. Chim bồ câu
D. Chó sói

Câu 2: Phát biểu nào sau đây đúng?
A*. Vận tốc là đại lượng vectơ
B. Quãng đường là đại lượng vectơ
C. Thời gian có hướng
D. Khối lượng có thể âm

Câu 3: Đâu là oxit bazơ?
A. SO2
B. CO2
[x] C. CaO
D. P2O5
`;
      const parsed = parseExamCode(code);
      expect(parsed.questions).toHaveLength(3);
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].options.find(o => parsed.questions[0].correctOptionIds.includes(o.id))?.letter).toBe('C');

      expect(parsed.questions[1].hasAnswer).toBe(true);
      expect(parsed.questions[1].options.find(o => parsed.questions[1].correctOptionIds.includes(o.id))?.letter).toBe('A');

      expect(parsed.questions[2].hasAnswer).toBe(true);
      expect(parsed.questions[2].options.find(o => parsed.questions[2].correctOptionIds.includes(o.id))?.letter).toBe('C');
    });

    it('nhận diện bảng đáp án dạng danh sách inline (1. A   2. B   3. C   4. D)', () => {
      const code = `
PHẦN I. TRẮC NGHIỆM
Câu 1: Câu hỏi thứ nhất
A. Phương án 1
B. Phương án 2
C. Phương án 3
D. Phương án 4

Câu 2: Câu hỏi thứ hai
A. Lựa chọn 1
B. Lựa chọn 2
C. Lựa chọn 3
D. Lựa chọn 4

HẾT
BẢNG ĐÁP ÁN
1. C    2. A
`;
      const parsed = parseExamCode(code);
      expect(parsed.questions).toHaveLength(2);
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].options.find(o => parsed.questions[0].correctOptionIds.includes(o.id))?.letter).toBe('C');
      expect(parsed.questions[1].hasAnswer).toBe(true);
      expect(parsed.questions[1].options.find(o => parsed.questions[1].correctOptionIds.includes(o.id))?.letter).toBe('A');
    });
  });
});