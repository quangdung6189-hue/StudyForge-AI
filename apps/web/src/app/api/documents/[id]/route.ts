import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getOwnedDocument, updateOwnedDocument } from '@/server/dal';
import { analyzeDocument } from '@/server/question-sections';
import { readExtractionMetadata } from '@/server/document-files';
import { DocumentPatchSchema } from '@studyforge/contracts';
import { isTransientDatabaseError } from '@studyforge/db';

function documentError(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, { status: number; message: string }> = {
    UNAUTHORIZED: { status: 401, message: 'Bạn cần đăng nhập để xem tài liệu.' },
    NOT_FOUND: { status: 404, message: 'Không tìm thấy tài liệu của bạn.' },
    CONFLICT: { status: 409, message: 'Tài liệu đã thay đổi ở nơi khác. Hãy tải lại và đối chiếu trước khi lưu.' },
  };
  if (code && messages[code]) return NextResponse.json({ error: { code, message: messages[code].message } }, { status: messages[code].status });
  const transient = isTransientDatabaseError(error);
  return NextResponse.json({ error: { code: transient ? 'DATABASE_UNAVAILABLE' : 'DOCUMENT_ERROR', message: transient ? 'Kết nối dữ liệu đang gián đoạn. Hãy thử lại sau vài giây.' : 'Chưa xử lý được tài liệu. Hãy thử lại.' } }, { status: transient ? 503 : 500, headers: { 'Cache-Control': 'no-store', ...(transient ? { 'Retry-After': '2' } : {}) } });
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const document = await getOwnedDocument(user.id, id);
    return NextResponse.json({ ...document, analysis: analyzeDocument(document.rawText ?? ''), tools: { layoutReader: Boolean(process.env.DOCLING_BASE_URL) }, extraction: await readExtractionMetadata(id, document.revision) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return documentError(error); }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = DocumentPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Nội dung hoặc tên tài liệu chưa hợp lệ.' } }, { status: 400 });
    const body = parsed.data;

    const updated = await updateOwnedDocument(user.id, id, {
      title: body.title,
      rawText: body.rawText,
    }, body.revision);

    return NextResponse.json({ success: true, document: updated });
  } catch (error) { return documentError(error); }
}
