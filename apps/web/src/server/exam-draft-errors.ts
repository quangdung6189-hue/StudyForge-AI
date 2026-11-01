import { ZodError } from 'zod';
import { isTransientDatabaseError } from '@studyforge/db';
import { UploadError } from './upload-errors';
export function examDraftError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const known = ['UNAUTHORIZED', 'NOT_FOUND', 'CONFLICT', 'INVALID_EXAM'].includes(code ?? '');
  const status = error instanceof UploadError ? error.status : code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : error instanceof ZodError || error instanceof SyntaxError || code === 'INVALID_EXAM' ? 400 : isTransientDatabaseError(error) ? 503 : 500;
  const message = error instanceof UploadError ? 'Dữ liệu bản soạn vượt giới hạn cho phép.' : known ? (error as Error).message || 'Bạn cần đăng nhập.' : status === 400 ? 'Dữ liệu bản soạn chưa hợp lệ.' : 'Chưa lưu được bản soạn. Giữ nội dung và thử lại.';
  return Response.json({ error: { code: known ? code : 'DRAFT_ERROR', message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}