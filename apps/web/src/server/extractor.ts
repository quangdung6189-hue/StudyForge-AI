import mammoth from 'mammoth';
import { chunkText } from '@studyforge/core';

export class ExtractorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractorError';
  }
}

export async function extractDocumentContent(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<{ rawText: string; chunks: Array<{ chunkIndex: number; content: string; pageNumber: number | null }> }> {
  let rawText = '';
  const lower = fileName.toLowerCase();

  if (fileType === 'application/pdf' || lower.endsWith('.pdf')) {
    try {
      const pdfParseModule: any = await import('pdf-parse');
      if (typeof pdfParseModule.PDFParse === 'function') {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        rawText = (await parser.getText()) || '';
        if (typeof parser.destroy === 'function') await parser.destroy();
      } else if (typeof pdfParseModule.default === 'function' || typeof pdfParseModule === 'function') {
        const fn = pdfParseModule.default || pdfParseModule;
        const parsed = await fn(buffer);
        rawText = parsed?.text || '';
      }
    } catch {
      rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\u00A0-\u024F\u1EA0-\u1EF9\n\r\t]/g, ' ');
    }
  } else if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
    } catch (e) {
      throw new ExtractorError('Không thể đọc file DOCX: ' + (e as Error).message);
    }
  } else if (fileType.startsWith('image/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    rawText = `[Hình ảnh: ${fileName}] Tài liệu dạng hình ảnh cần xử lý qua công cụ OCR tiếng Việt. Bạn có thể bổ sung nội dung văn bản thủ công tại màn hình chỉnh sửa tài liệu.`;
  } else if (fileType.startsWith('text/') || lower.endsWith('.txt')) {
    rawText = buffer.toString('utf-8');
  } else {
    rawText = buffer.toString('utf-8');
  }

  // Normalize Unicode (NFC) for proper Vietnamese tone marks
  rawText = rawText.normalize('NFC').trim();

  if (!rawText || rawText.length < 10) {
    rawText = 'Tài liệu: ' + fileName + '\nNội dung đang chờ nhận dạng OCR hoặc kiểm tra cấu trúc.';
  }

  const chunks = chunkText(rawText, 1500, 150);
  return { rawText, chunks };
}
