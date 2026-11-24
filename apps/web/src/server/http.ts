import { NextResponse } from 'next/server';
import { AIGatewayError } from '@studyforge/ai';
import { isTransientDatabaseError } from '@studyforge/db';

const STATUS: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, EXPIRED: 410, INVALID_INPUT: 400 };
const DEFAULTS: Record<string, string> = {
  UNAUTHORIZED: 'Bạn cần đăng nhập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  CONFLICT: 'Thao tác chưa thực hiện được.',
  EXPIRED: 'Đã hết thời hạn.',
  INVALID_INPUT: 'Dữ liệu gửi lên chưa hợp lệ.',
};

export const noStore = { 'Cache-Control': 'no-store' };

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...noStore, ...(init?.headers ?? {}) } });
}

export function invalid(message = DEFAULTS.INVALID_INPUT) {
  return NextResponse.json({ error: { code: 'INVALID_INPUT', message } }, { status: 400, headers: noStore });
}

/** Map DAL/auth/AI errors to the API error contract without leaking internals. */
export function apiError(error: unknown) {
  if (error instanceof AIGatewayError) {
    const message = error.code === 'CONFIGURATION' ? 'Chưa cấu hình kết nối AI trên máy chủ.' : error.code === 'TIMEOUT' ? 'AI phản hồi quá lâu. Hãy thử lại.' : 'AI chưa trả kết quả hợp lệ. Hãy thử lại.';
    return NextResponse.json({ error: { code: error.code, message } }, { status: error.code === 'CONFIGURATION' ? 503 : error.code === 'TIMEOUT' ? 504 : 502, headers: noStore });
  }
  const code = (error as { code?: string }).code ?? '';
  if (STATUS[code]) {
    const message = code === 'UNAUTHORIZED' ? DEFAULTS.UNAUTHORIZED : (error as Error).message || DEFAULTS[code];
    return NextResponse.json({ error: { code, message } }, { status: STATUS[code], headers: noStore });
  }
  if (isTransientDatabaseError(error)) {
    return NextResponse.json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Kết nối dữ liệu đang gián đoạn. Hãy thử lại sau vài giây.' } }, { status: 503, headers: { ...noStore, 'Retry-After': '2' } });
  }
  console.error('[api]', (error as Error)?.name, (error as Error)?.message);
  return NextResponse.json({ error: { code: 'SERVER_ERROR', message: 'Máy chủ chưa xử lý được yêu cầu. Hãy thử lại.' } }, { status: 500, headers: noStore });
}

export async function body(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}));
}
