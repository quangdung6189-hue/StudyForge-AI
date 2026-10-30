import { z } from 'zod';
import { chunkText } from '@studyforge/core';
const Output = z.object({ status: z.string().optional(), document: z.object({ text_content: z.string().nullable().optional(), md_content: z.string().nullable().optional(), json_content: z.unknown().optional() }) });

/** Optional local/self-hosted open-source layout reader. User files never go to a public demo. */
export async function readWithDocling(buffer: Buffer, fileName: string, signal?: AbortSignal) {
  if (!process.env.DOCLING_BASE_URL) throw new Error('Docling chưa được cấu hình.');
  const base = new URL(process.env.DOCLING_BASE_URL);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname))) throw new Error('Docling cần HTTPS hoặc máy chủ cục bộ.');
  const configuredTimeout = Number(process.env.AI_TIMEOUT_MS);
  const timeout = Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0 && configuredTimeout <= 2_147_483_647
    ? configuredTimeout
    : 90_000;
  const response = await fetch(`${base.href.replace(/\/+$/, '')}/v1/convert/source`, { method: 'POST', redirect: 'error', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeout)]), headers: { 'Content-Type': 'application/json', ...(process.env.DOCLING_API_KEY ? { 'X-Api-Key': process.env.DOCLING_API_KEY } : {}) },
    body: JSON.stringify({ options: { to_formats: ['text','json'], do_ocr: true, image_export_mode: 'placeholder' }, sources: [{ kind: 'file', filename: fileName, base64_string: buffer.toString('base64') }], target: { kind: 'inbody' } }),
  });
  if (!response.ok) throw new Error('Chưa kết nối được bộ đọc bố cục. Bản đã lưu được giữ nguyên.');
  const raw = await response.text(); if (raw.length > 12_000_000) throw new Error('Kết quả đọc quá lớn. Hãy tách tài liệu.');
  const data = Output.parse(JSON.parse(raw));
  if (data.status && !['success','partial_success'].includes(data.status)) throw new Error('Bộ đọc chưa xử lý xong tài liệu.');
  const rawText = (data.document.text_content ?? data.document.md_content ?? '').normalize('NFC').replace(/\r\n?/g,'\n').trim();
  if (!rawText) throw new Error('Bộ đọc không tìm thấy chữ trong tài liệu.');
  const uncertain = data.status === 'partial_success';
  return { rawText, chunks: chunkText(rawText,1800,250), method: 'docling' as const, needsOcr: uncertain, pages: [{ number: 1, characters: rawText.length }], warnings: [ ...(uncertain ? ['Bộ đọc bố cục chỉ xử lý được một phần; cần kiểm tra bản gốc.'] : []), 'Bộ đọc bố cục chưa cung cấp vị trí trang trong bản văn bản; hãy đối chiếu bản gốc.' ] };
}
