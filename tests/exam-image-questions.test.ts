import { describe, expect, it } from 'vitest';
import { parseExamCode, detectImageRefs } from '../apps/web/src/lib/exam-code';
import { bottomUpLayout } from '../apps/web/src/lib/exam-layout';
import { parseExamPro } from '../apps/web/src/server/exam-parser-pro';
import { analyzeDocument } from '../apps/web/src/server/question-sections';
import { documentHtmlToText } from '../apps/web/src/server/document-html';

describe('Image-based question detection', () => {
  describe('detectImageRefs utility', () => {
    it('detects [Hình ...] placeholder in stem', () => {
      const result = detectImageRefs('Cho hàm số có đồ thị như [Hình 1]. Chọn phát biểu đúng:', [], '');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs).toHaveLength(1);
      expect(result.imageRefs[0].position).toBe('stem');
      expect(result.imageRefs[0].placeholder).toBe('[Hình 1]');
    });

    it('detects [Sơ đồ], [Biểu đồ], [Đồ thị] placeholders', () => {
      for (const tag of ['Sơ đồ tư duy', 'Biểu đồ cột', 'Đồ thị hàm số']) {
        const result = detectImageRefs(`Quan sát [${tag}] sau đây:`, [], '');
        expect(result.hasImage).toBe(true);
        expect(result.imageRefs[0].placeholder).toBe(`[${tag}]`);
      }
    });

    it('detects Hình X.Y reference without brackets', () => {
      const result = detectImageRefs('Dựa vào Hình 2.3 hãy cho biết:', [], '');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs.some(ref => ref.placeholder.includes('Hình 2.3'))).toBe(true);
    });

    it('detects Figure/Diagram English patterns', () => {
      const result = detectImageRefs('According to Figure 5, what is the value?', [], '');
      expect(result.hasImage).toBe(true);
    });

    it('detects embedded-image from DOCX conversion', () => {
      const result = detectImageRefs('Câu hỏi có embedded-image ở đây.', [], '');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs[0].placeholder).toBe('embedded-image');
    });

    it('detects [không đọc rõ] from OCR output', () => {
      const result = detectImageRefs('Tính diện tích hình [không đọc rõ]', [], '');
      expect(result.hasImage).toBe(true);
    });

    it('detects image in option text', () => {
      const result = detectImageRefs('Chọn đáp án:', [{ letter: 'A', text: 'Xem [Hình 2]' }, { letter: 'B', text: 'Không có hình' }], '');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs[0].position).toBe('option');
    });

    it('detects image in explanation', () => {
      const result = detectImageRefs('Câu hỏi thường', [], 'Xem lời giải tại [Hình 3]');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs[0].position).toBe('explanation');
    });

    it('returns hasImage=false when no image references', () => {
      const result = detectImageRefs('Hai cộng hai bằng bao nhiêu?', [{ letter: 'A', text: '3' }, { letter: 'B', text: '4' }], '');
      expect(result.hasImage).toBe(false);
      expect(result.imageRefs).toHaveLength(0);
    });

    it('detects multiple images in one question', () => {
      const result = detectImageRefs('So sánh [Hình 1] và [Hình 2]:', [{ letter: 'A', text: 'Xem [Đồ thị 1]' }], '');
      expect(result.hasImage).toBe(true);
      expect(result.imageRefs.length).toBeGreaterThanOrEqual(3);
    });

    it('detects (Hình N) parenthesized pattern', () => {
      const result = detectImageRefs('Quan sát (Hình 4) và trả lời:', [], '');
      expect(result.hasImage).toBe(true);
    });

    it('detects [Minh họa] and [Ảnh] patterns', () => {
      const r1 = detectImageRefs('Xem [Minh họa bên dưới]', [], '');
      expect(r1.hasImage).toBe(true);
      const r2 = detectImageRefs('Tham khảo [Ảnh chụp thí nghiệm]', [], '');
      expect(r2.hasImage).toBe(true);
    });
  });

  describe('parseExamCode with image detection', () => {
    it('sets hasImage=true for MC question with image in stem', () => {
      const code = 'Câu 1: Cho hàm số có đồ thị như [Hình 1]. Giá trị cực đại là?\nA. 1\nB. 2\nC. 3\nD. 4\nĐáp án: B';
      const parsed = parseExamCode(code);
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].type).toBe('single');
      expect(parsed.questions[0].hasImage).toBe(true);
      expect(parsed.questions[0].imageRefs).toHaveLength(1);
      expect(parsed.questions[0].imageRefs[0].position).toBe('stem');
      expect(parsed.questions[0].hasAnswer).toBe(true);
    });

    it('sets hasImage=false for plain text question', () => {
      const code = 'Câu 1: Thủ đô Việt Nam là gì?\nA. Hà Nội\nB. Đà Nẵng\nC. Huế\nD. Cần Thơ\nĐáp án: A';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].hasImage).toBe(false);
      expect(parsed.questions[0].imageRefs).toHaveLength(0);
    });

    it('detects image in true/false question', () => {
      const code = 'PHẦN II. ĐÚNG SAI\nCâu 1: Dựa vào [Đồ thị 1], xét các nhận định:\na) Hàm đồng biến trên (0, 2). ĐÚNG\nb) Giá trị nhỏ nhất bằng -1. SAI';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('boolean');
      expect(parsed.questions[0].hasImage).toBe(true);
      expect(parsed.questions[0].imageRefs[0].placeholder).toBe('[Đồ thị 1]');
    });

    it('detects image in short answer question', () => {
      const code = 'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Quan sát Hình 3.2 và tính diện tích tam giác bằng bao nhiêu?\nĐáp án: 12';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('short');
      expect(parsed.questions[0].hasImage).toBe(true);
    });

    it('adds IMAGE_REFERENCE warning when image has no description', () => {
      const code = 'Câu 1: Xem [Hình 1] và chọn:\nA. Đúng\nB. Sai\nC. Không rõ\nD. Khác\nĐáp án: A';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].issues.some(i => i.code === 'IMAGE_REFERENCE')).toBe(true);
      expect(parsed.questions[0].issues.find(i => i.code === 'IMAGE_REFERENCE')?.severity).toBe('warning');
    });

    it('image detection does not affect answer extraction', () => {
      const code = 'Câu 1: Dựa vào [Biểu đồ 1], tính giá trị?\nA. 10\n*B. 20\nC. 30\nD. 40';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].hasImage).toBe(true);
      expect(parsed.questions[0].hasAnswer).toBe(true);
      expect(parsed.questions[0].correctOptionIds).toHaveLength(1);
    });
  });

  describe('parseExamPro with image fields', () => {
    it('exports has_image and image_refs for image questions', () => {
      const code = 'Câu 1: Quan sát [Hình 1] và cho biết:\nA. Lựa chọn 1\nB. Lựa chọn 2\nC. Lựa chọn 3\nD. Lựa chọn 4\nĐáp án: C';
      const pro = parseExamPro(code, 'Test Image');
      expect(pro.questions[0].has_image).toBe(true);
      expect(pro.questions[0].image_refs).toBeDefined();
      expect(pro.questions[0].image_refs!.length).toBeGreaterThan(0);
      expect(pro.questions[0].image_refs![0].position).toBe('stem');
    });

    it('exports has_image=false for non-image questions', () => {
      const code = 'Câu 1: Câu hỏi bình thường\nA. A\nB. B\nC. C\nD. D\nĐáp án: A';
      const pro = parseExamPro(code, 'Test');
      expect(pro.questions[0].has_image).toBe(false);
      expect(pro.questions[0].image_refs).toHaveLength(0);
    });

    it('adds image warning to pro warnings when image questions exist', () => {
      const code = 'Câu 1: Xem [Hình 1]\nA. A\nB. B\nC. C\nD. D\nĐáp án: A';
      const pro = parseExamPro(code, 'Test');
      expect(pro.warnings.some(w => w.includes('hình ảnh'))).toBe(true);
    });
  });

  describe('documentHtmlToText image placeholder insertion', () => {
    it('inserts [Hình N] placeholder for img tags', () => {
      const html = '<p>Câu 1: Quan sát hình dưới đây</p><img src="embedded-image"/><p>A. Đúng</p>';
      const result = documentHtmlToText(html);
      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1);
      expect(result.text).toContain('[Hình 1]');
    });

    it('inserts numbered placeholders for multiple images', () => {
      const html = '<p>Câu 1:</p><img src="a.png"/><p>Câu 2:</p><img src="b.png"/>';
      const result = documentHtmlToText(html);
      expect(result.imageCount).toBe(2);
      expect(result.text).toContain('[Hình 1]');
      expect(result.text).toContain('[Hình 2]');
    });

    it('includes alt text in placeholder when available', () => {
      const html = '<p>Xem hình:</p><img src="x.png" alt="Đồ thị parabol"/>';
      const result = documentHtmlToText(html);
      expect(result.text).toContain('[Hình 1: Đồ thị parabol]');
    });

    it('preserves backward compatibility for documents without images', () => {
      const html = '<p>Câu 1: Hai cộng hai bằng bao nhiêu?</p><p>A. 3</p><p>B. 4</p>';
      const result = documentHtmlToText(html);
      expect(result.hasImages).toBe(false);
      expect(result.imageCount).toBe(0);
    });
  });
});

describe('Enhanced question type detection', () => {
  describe('Multiple-select enhanced stem patterns', () => {
    it.each([
      'Những ý nào sau đây đúng về quang hợp?',
      'Các phát biểu nào là đúng?',
      'Ý nào sau đây đúng về kim loại kiềm?',
      'Có bao nhiêu phát biểu đúng trong các phát biểu sau?',
      'Những đáp án đúng là gì?',
      'Các mệnh đề đúng gồm:',
      'Gồm những hiện tượng nào sau đây?',
      'Bao gồm những phát biểu nào?',
      'Liệt kê các tính chất đúng:',
    ])('detects multiple-select for stem: "%s"', (stem) => {
      const code = `Câu 1: ${stem}\nA. Phát biểu 1\nB. Phát biểu 2\nC. Phát biểu 3\nD. Phát biểu 4\nĐáp án: A, C`;
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('multiple');
    });
  });

  describe('Fill-in-blank enhanced detection', () => {
    it('detects fill-in-blank with .... (4+ dots)', () => {
      const code = 'PHẦN III. ĐIỀN TỪ\nCâu 1: Quang hợp diễn ra tại bào quan .... trong tế bào lá.\nĐáp án: lục lạp';
      const parsed = parseExamCode(code);
      expect(parsed.questions[0].type).toBe('fill');
    });

    it('detects fill-in-blank with hoàn thành heading', () => {
      const layout = bottomUpLayout(['Điền từ còn thiếu vào chỗ trống: Nước sôi ở _____ độ C.'], 'HOÀN THÀNH CÂU SAU');
      expect(layout.kind).toBe('fill');
    });

    it('detects fill-in-blank with {blank} pattern', () => {
      const layout = bottomUpLayout(['Điền từ vào {blank} để hoàn thành câu.'], '');
      expect(layout.kind).toBe('fill');
    });
  });

  describe('Short-answer enhanced detection', () => {
    it.each([
      'Kết quả là bao nhiêu?',
      'Đáp số của bài toán là gì?',
      'Đáp án là bao nhiêu?',
      'Bằng bao nhiêu cm?',
      'Số nào chia hết cho 7?',
      'Thủ đô của Việt Nam là gì?',
    ])('detects short-answer for stem: "%s"', (stem) => {
      const layout = bottomUpLayout([stem], 'PHẦN III. TRẢ LỜI NGẮN');
      expect(layout.kind).toBe('short');
    });
  });
});

