import mammoth from 'mammoth';
import { z } from 'zod';
import { chunkText } from '@studyforge/core';
import { gatewayFromEnv } from '@studyforge/ai';
import { documentHtmlToText } from './document-html';

export class ExtractorError extends Error { constructor(message: string) { super(message); this.name = 'ExtractorError'; } }
const VisionSchema = z.strictObject({ text: z.string().max(60000), uncertain: z.boolean(), warnings: z.array(z.string().max(500)).max(20) });
type Options = { ocr?: boolean; forceVision?: boolean; signal?: AbortSignal; onProgress?: (done: number, total: number) => void };
async function recognizePage(image: string, signal?: AbortSignal) {
  return gatewayFromEnv().structured({ schema: VisionSchema, name: 'DocumentPage', purpose: 'generate', signal, images: [image],
    system: 'Bạn là bộ đọc tài liệu, KHÔNG phải bộ giải đề. Chỉ chép chính xác chữ, số, công thức và cấu trúc nhìn thấy. Giữ nguyên PHẦN I/II/III, Câu 1, A/B/C/D, từng ý a/b/c/d, bảng và đáp án gốc. QUAN TRỌNG — tuyến tính hóa bố cục: nếu A/B/C/D nằm 2 cột hoặc chung hàng, tách mỗi phương án thành MỘT DÒNG riêng theo thứ tự A-B-C-D. Với bảng đáp án, giữ mỗi hàng một dòng, các ô cách nhau bằng tab. Không tự trả lời hoặc bổ sung kiến thức. Chỉ thêm [Đáp án] nếu tài liệu ghi rõ đó là đáp án (kể cả chú giải màu rõ ràng). Chỗ không đọc chắc ghi [không đọc rõ], uncertain=true. Với hình/đồ thị chưa mô tả đủ để làm câu hỏi, ghi cảnh báo; không đoán. Trả text trống nếu ảnh không có chữ.',
    prompt: 'Đọc toàn bộ trang từ trên xuống, trái sang phải. Mỗi phương án A/B/C/D một dòng riêng, kể cả khi bản gốc xếp 2 cột. Không bỏ các cột, bảng hay các ý đúng/sai.',
  });
}

export async function extractDocumentContent(buffer: Buffer, fileType: string, fileName: string, options: Options = {}) {
  const lower = fileName.toLowerCase(), warnings: string[] = [];
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
      const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(async () => ({ src: 'embedded-image' })) });
      const parsed = documentHtmlToText(result.value); pages = [parsed.text];
      if (parsed.hasImages) warnings.push('DOCX có hình ảnh/sơ đồ. Hãy đối chiếu bản gốc; nội dung hình chưa nằm trong phần chữ.');
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
  pages = pages.map(text => text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u200B\uFEFF]/g, '').trim());
  const rawText = pages.join('\f');
  if (!rawText.trim()) needsOcr = true;
  const chunks = chunkText(rawText, 1800, 250);
  return { rawText, chunks, pages: pages.map((text, i) => ({ number: i + 1, characters: text.length })), method, needsOcr, warnings };
}
