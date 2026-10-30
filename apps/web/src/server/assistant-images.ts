import { z } from 'zod';

/** Only inline raster images, never remote URLs or SVG/HTML. */
export const AssistantImageSchema = z.string().max(1_500_000).superRefine((value, context) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) { context.addIssue({ code: 'custom', message: 'Ảnh phải là PNG, JPEG hoặc WebP hợp lệ.' }); return; }
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (!valid || bytes.length < 16) context.addIssue({ code: 'custom', message: 'Nội dung ảnh không khớp định dạng.' });
});
