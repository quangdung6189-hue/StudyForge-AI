import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { listUserDocuments } from '@/server/dal';
import { PaginationSchema } from '@studyforge/contracts';
import { isTransientDatabaseError } from '@studyforge/db';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const pagination = PaginationSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!pagination.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Trang và số tài liệu yêu cầu không hợp lệ.' } }, { status: 400 });
    const { page, limit } = pagination.data;

    const result = await listUserDocuments(user.id, page, limit);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isTransientDatabaseError(error)) return NextResponse.json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Kết nối dữ liệu đang gián đoạn. Vui lòng thử lại sau vài giây.' } }, { status: 503, headers: { 'Retry-After': '2', 'Cache-Control': 'no-store' } });
    const code = (error as { code?: string }).code;
    const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: { code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'DOCUMENTS_ERROR', message: status === 401 ? 'Bạn cần đăng nhập để xem tài liệu.' : status === 403 ? 'Bạn không có quyền xem tài liệu này.' : 'Không thể tải thư viện tài liệu. Vui lòng thử lại.' } }, { status });
  }
}
