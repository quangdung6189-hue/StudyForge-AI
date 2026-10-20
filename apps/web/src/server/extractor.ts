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
      // Dynamic import to handle pdf-parse in ESNext/Bundler
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParse = (pdfParseModule.default || pdfParseModule) as (buf: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      rawText = parsed.text || '';
    } catch {
      // Fallback text extraction if binary parse error
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
  } else if (fileType.startsWith('text/') || lower.endsWith('.txt')) {
    rawText = buffer.toString('utf-8');
  } else {
    // Other text files or images
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
