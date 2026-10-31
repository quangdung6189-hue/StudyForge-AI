import { randomUUID } from 'node:crypto';
import { isTransientDatabaseError } from '@studyforge/db';
import { ExtractorError } from './extractor';

export class UploadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

export function uploadErrorResponse(error: unknown) {
  const value = error as { code?: string; errorCode?: string; name?: string } | null;
  const internalCode = value?.code ?? value?.errorCode;
  let status = 500, code = 'UPLOAD_ERROR', message = 'Chưa xử lý được tài liệu. Hãy thử lại.';
  if (error instanceof UploadError) { ({ status, code, message } = error); }
  else if (internalCode === 'UNAUTHORIZED') { status = 401; code = 'UNAUTHORIZED'; message = 'Bạn cần đăng nhập để tải tài liệu.'; }
  else if (isTransientDatabaseError(error)) { status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'Kết nối database đang gián đoạn. Hãy thử lại sau vài giây.'; }
  else if (internalCode === 'P2021' || internalCode === 'P2022') { status = 503; code = 'UPLOAD_SCHEMA_MISSING'; message = 'Database chưa cập nhật bảng lưu tài liệu. Quản trị viên cần chạy npm run db:migrate rồi triển khai lại.'; }
  else if (internalCode === 'EROFS' || internalCode === 'EACCES') { code = 'STORAGE_NOT_WRITABLE'; message = 'Máy chủ không cho ghi kho file local. Cần dùng bản cập nhật lưu tài liệu trong database.'; }
  else if (error instanceof ExtractorError) { status = 422; code = 'INVALID_DOCUMENT'; message = error.message; }
  else if (value?.name === 'PrismaClientInitializationError' || ['P1000', 'P1003', 'P1010'].includes(internalCode ?? '')) { status = 503; code = 'DATABASE_CONFIG_ERROR'; message = 'Máy chủ chưa kết nối được database. Quản trị viên cần kiểm tra DATABASE_URL và Prisma trong Runtime Logs.'; }
  const requestId = randomUUID();
  // Never log file bytes, user filenames, SQL, connection strings or secrets.
  if (status >= 500) console.error('[document-upload]', { requestId, code, internalCode: /^P\d{4}$|^E[A-Z]+$/.test(internalCode ?? '') ? internalCode : undefined });
  return Response.json({ error: { code, message, requestId } }, { status, headers: { 'Cache-Control': 'no-store', ...(code === 'DATABASE_UNAVAILABLE' ? { 'Retry-After': '2' } : {}) } });
}

export async function boundedBody(req: Request, limit: number): Promise<Buffer> {
  if (Number(req.headers.get('content-length')) > limit) throw new UploadError('FILE_TOO_LARGE', 'Phần tải lên vượt giới hạn cho phép.', 413);
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new UploadError('FILE_TOO_LARGE', 'Phần tải lên vượt giới hạn cho phép.', 413); }
      parts.push(value);
    }
    return Buffer.concat(parts, size);
  } finally { reader.releaseLock(); }
}