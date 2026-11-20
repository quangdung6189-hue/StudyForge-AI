import mammoth from 'mammoth';
import { z } from 'zod';
import { chunkText } from '@studyforge/core';
import { gatewayFromEnv } from '@studyforge/ai';
import { documentHtmlToText } from './document-html';
import { readDocxAnswerMarks, validateDocxArchive, type AnswerMarkEvidence } from './document-answer-marks';
import { extractDocxMediaAndMath } from './document-media';
import { preprocessDocxMathAndImages } from './docx-preprocessor';
import { unglueExamText } from '@/lib/exam-layout';
import { sanitizeExamText } from '@/lib/text-sanitizer';

export class ExtractorError extends Error { constructor(message: string) { super(message); this.name = 'ExtractorError'; } }
const VisionSchema = z.strictObject({ text: z.string().max(60000), uncertain: z.boolean(), warnings: z.array(z.string().max(500)).max(20) });
type Options = { ocr?: boolean; forceVision?: boolean; signal?: AbortSignal; onProgress?: (done: number, total: number) => void };
async function recognizePage(image: string, signal?: AbortSignal) {
  return gatewayFromEnv().structured({ schema: VisionSchema, name: 'DocumentPage', purpose: 'generate', signal, images: [image],
    system: 'Bạn là bộ đọc tài liệu, KHÔNG phải bộ giải đề. Chỉ chép chính xác chữ, số, công thức và cấu trúc nhìn thấy. Giữ nguyên PHẦN I/II/III, Câu 1, A/B/C/D, từng ý a/b/c/d, bảng và đáp án gốc. QUAN TRỌNG — tuyến tính hóa bố cục: nếu A/B/C/D nằm 2 cột hoặc chung hàng, tách mỗi phương án thành MỘT DÒNG riêng theo thứ tự A-B-C-D. Với bảng đáp án, giữ mỗi hàng một dòng, các ô cách nhau bằng tab. Không tự trả lời hoặc bổ sung kiến thức. Chỉ thêm [Đáp án] nếu tài liệu ghi rõ đó là đáp án (kể cả chú giải màu rõ ràng). Chỗ không đọc chắc ghi [không đọc rõ], uncertain=true. Với hình ảnh, sơ đồ, đồ thị, biểu đồ, bản đồ hoặc hình minh họa: ghi [Hình: mô tả ngắn gọn nội dung hình, ví dụ: đồ thị hàm số bậc hai có đỉnh tại (2,3), sơ đồ mạch điện nối tiếp gồm R1 và R2, bản đồ Việt Nam có đánh dấu vùng Đông Nam Bộ]. Nếu hình quá phức tạp hoặc không mô tả đủ chi tiết, ghi [Hình: cần đối chiếu bản gốc] và thêm cảnh báo. Trả text trống nếu ảnh không có chữ.',
    prompt: 'Đọc toàn bộ trang từ trên xuống, trái sang phải. Mỗi phương án A/B/C/D một dòng riêng, kể cả khi bản gốc xếp 2 cột. Không bỏ các cột, bảng hay các ý đúng/sai. Với tự luận/trả lời ngắn: giữ ranh giới câu hỏi, Trả lời/Đáp án, Lời giải/Giải thích như bản gốc; nhãn thiếu dấu hai chấm vẫn giữ thành dòng riêng. Đáp án nhiều dòng, đề và phần đáp án cuối tài liệu phải tách vùng rõ, không gộp lời giải vào câu hỏi. Không tạo nhãn đáp án nếu không có bằng chứng nguồn. Với mỗi hình ảnh/đồ thị/sơ đồ trong trang: chèn placeholder [Hình: mô tả] vào đúng vị trí trong luồng text, kèm mô tả ngắn gọn các thông tin có thể đọc được (nhãn trục, giá trị, hướng mũi tên, tên thành phần). Không bịa thông tin không nhìn thấy.',
  });
}

export async function extractDocumentContent(buffer: Buffer, fileType: string, fileName: string, options: Options = {}) {
  const lower = fileName.toLowerCase(), warnings: string[] = [];
  let answerMarks: AnswerMarkEvidence[] = [];
  let mediaMap: Record<number, string> = {};
  let pages: string[] = [], method: 'native' | 'vision' | 'mixed' = 'native', needsOcr = false;
  if (lower.endsWith('.pdf') || fileType === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ lineEnforce: true, cellSeparator: '\t', pageJoiner: '' });
      pages = result.pages.map(page => page.text);
      if (!pages.length) pages = [result.text ?? ''];
      const looksFragmented = (text: string): boolean => {
        const t = text.replace(/\s/g, "");
        if (!t || t.length < 30) return true;
        const ls = text.split("\n").map((x: string) => x.trim()).filter(Boolean);
        if (ls.length > 8 && t.length / ls.length < 12) return true;
        return false;
      };
      const targets = pages.flatMap((text: string, index: number) => { if (options.forceVision) return [index];
        const noMarks = text.replace(/\s/g, "").length < 30;
        const crammed = text.split("\n").some((line: string) => [...line.matchAll(/C\u00e2u\s+\d+\s*[.:]/giu)].length > 1);
        if (crammed && text.replace(/\s/g, "").length > 400) return [];
        if (noMarks || crammed || looksFragmented(text)) return [index];
        return []; });
      if (targets.length && options.ocr) {
        // Bound one upload/re-read. The remaining pages are explicit, never silently declared ready.
        const limit = Math.min(40, Math.max(1, Number(process.env.OCR_MAX_PAGES) || 20));
        const work = targets.slice(0, limit); let cursor = 0, done = 0;
        await Promise.all(Array.from({ length: Math.min(2, work.length) }, async () => {
          while (cursor < work.length) {
            options.signal?.throwIfAborted(); const index = work[cursor++];
            try {
              const rendered = await parser.getScreenshot({ partial: [index + 1], desiredWidth: 1500, imageDataUrl: true, imageBuffer: false });
              const output = await recognizePage(rendered.pages[0].dataUrl, options.signal);
              pages[index] = output.text; warnings.push(...output.warnings.map(warning => `Trang ${index + 1}: ${warning}`));
              if (output.uncertain || !output.text.trim()) needsOcr = true;
            } catch { needsOcr = true; warnings.push(`Trang ${index + 1}: chưa đọc được bằng OCR; cần thử lại hoặc bổ sung văn bản.`); }
            options.onProgress?.(++done, work.length);
          }
        }));
        method = targets.length === pages.length ? 'vision' : 'mixed';
        if (targets.length > work.length) { needsOcr = true; warnings.push(`Còn ${targets.length - work.length} trang cần OCR. Hãy tách PDF thành phần tối đa ${limit} trang để đọc rõ.`); }
      } else if (targets.length) { needsOcr = true; warnings.push(`${targets.length} trang ít hoặc không có lớp chữ; cần OCR.`); }
    } catch (error) { if ((error as Error).name === 'AbortError') throw error; throw new ExtractorError('Không đọc được cấu trúc PDF. Hãy kiểm tra tệp hoặc dùng chức năng OCR.'); }
    finally { await parser.destroy(); }
  } else if (lower.endsWith('.docx') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      await validateDocxArchive(buffer);
      const preprocessed = await preprocessDocxMathAndImages(buffer);
      const mediaResult = await extractDocxMediaAndMath(buffer);
      let docxImageCount = 0;
      const docxMediaMap: Record<number, string> = {};
      const result = await mammoth.convertToHtml(
        { buffer: preprocessed.buffer },
        {
          externalFileAccess: false,
          convertImage: mammoth.images.imgElement(async (image) => {
            docxImageCount++;
            try {
              const base64 = await image.read('base64');
              const dataUrl = `data:${image.contentType};base64,${base64}`;
              docxMediaMap[docxImageCount] = dataUrl;
              return { src: dataUrl };
            } catch {
              return { src: 'embedded-image' };
            }
          }),
        }
      );
      const parsed = documentHtmlToText(result.value);
      mediaMap = { ...mediaResult.mediaMap, ...parsed.mediaMap, ...docxMediaMap };
      const formatted = await readDocxAnswerMarks(buffer, parsed.text);
      pages = [formatted.rawText]; answerMarks = formatted.evidence; warnings.push(...formatted.warnings);
      if (parsed.hasImages || Object.keys(mediaMap).length > 0) warnings.push('DOCX có hình ảnh/sơ đồ; các hình ảnh đã được trích xuất để hiển thị trực tiếp.');
      if (mediaResult.ommlLatexCount > 0) warnings.push(`Đã nhận diện ${mediaResult.ommlLatexCount} công thức toán học OpenXML Math và sẵn sàng chuẩn hóa.`);
      if (result.messages.length) warnings.push('Một số định dạng DOCX cần đối chiếu bản gốc (công thức, hình hoặc bố cục đặc biệt).');
    } catch { throw new ExtractorError('Không đọc được DOCX. Hãy lưu lại tệp đúng định dạng DOCX hoặc chuyển sang PDF.'); }
  } else if (/\.(png|jpe?g)$/i.test(lower) || /^image\/(png|jpeg)$/.test(fileType)) {
    if (!options.ocr) { needsOcr = true; pages = ['']; warnings.push('Ảnh cần OCR để lấy chữ.'); }
    else {
      try {
        const mime = lower.endsWith('.png') || fileType === 'image/png' ? 'image/png' : 'image/jpeg';
        const output = await recognizePage(`data:${mime};base64,${buffer.toString('base64')}`, options.signal);
        pages = [output.text]; method = 'vision'; needsOcr = output.uncertain || !output.text.trim(); warnings.push(...output.warnings);
      } catch { pages = ['']; needsOcr = true; warnings.push('OCR chưa hoàn tất. Hãy thử đọc lại hoặc nhập văn bản đã kiểm tra.'); }
    }
  } else if (lower.endsWith('.txt') || fileType.startsWith('text/')) {
    let text: string;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.subarray(2).toString('utf16le');
    else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new ExtractorError('TXT không phải UTF-8 hoặc UTF-16. Hãy lưu lại bằng UTF-8 để giữ đúng dấu tiếng Việt.'); } }
    pages = text.split('\f');
  } else throw new ExtractorError('Định dạng tài liệu chưa được hỗ trợ.');
  // Preserve trailing/leading empty table cells represented by tabs, including the final row.
  pages = pages.map(text => sanitizeExamText(text).replace(/^[ \n]+|[ \n]+$/g, ''));
  const repaired = unglueExamText(pages.join('\f'));
  const rawText = repaired.text; warnings.push(...repaired.notices.map(notice => notice.message));
  if (!rawText.trim()) needsOcr = true;
  const chunks = chunkText(rawText, 1800, 250);
  return { rawText, chunks, pages: pages.map((text, i) => ({ number: i + 1, characters: text.length })), method, needsOcr, warnings, answerMarks, mediaMap };
}
