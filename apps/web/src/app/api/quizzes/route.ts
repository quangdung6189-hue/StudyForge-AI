import { NextResponse } from 'next/server';
import { isTransientDatabaseError } from '@studyforge/db';
import { requireUser } from '@/server/auth';
import { listUserQuizzes } from '@/server/dal';
import { saveQuiz, QuizSaveSchema } from '@/server/quiz-save';

export async function GET() {
  try { const user = await requireUser(); return NextResponse.json({ items: await listUserQuizzes(user.id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { const unauthorized = (error as { code?: string }).code === 'UNAUTHORIZED'; return NextResponse.json({ error: { code: unauthorized ? 'UNAUTHORIZED' : 'ERROR', message: 'Không thể tải danh sách đề.' } }, { status: unauthorized ? 401 : 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = QuizSaveSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0], index = issue.path[0] === 'questions' && typeof issue.path[1] === 'number' ? issue.path[1] + 1 : null;
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: index ? `Câu ${index} chưa hợp lệ. Kiểm tra nội dung, đáp án và lời giải trước khi lưu.` : 'Câu hỏi, đáp án hoặc cấu hình đề chưa hợp lệ.' } }, { status: 400 });
    }
    const result = await saveQuiz(user.id, parsed.data);
    return NextResponse.json(result, { status: result.reused ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'INVALID_CITATION' || error instanceof SyntaxError ? 400 : code === 'P2002' || code === 'CONFLICT' ? 409 : isTransientDatabaseError(error) || code === 'P2028' ? 503 : 500;
    const message = status === 401 ? 'Bạn cần đăng nhập lại để lưu đề.' : status === 404 ? 'Không tìm thấy tài liệu của bạn.' : code === 'INVALID_CITATION' ? 'Trích dẫn không khớp tài liệu hiện tại. Hãy tạo lại câu hỏi.' : status === 409 ? 'Bản nháp đã tồn tại hoặc có nội dung khác. Hãy mở lại từ ngân hàng đề.' : status === 503 ? 'Lưu đề đang bị gián đoạn. Giữ trang này và bấm lưu lại; hệ thống sẽ nhận diện bản nháp, không tạo trùng.' : 'Chưa lưu được đề. Nội dung vẫn ở trang duyệt; hãy thử lưu lại.';
    if (status >= 500) console.error('[quiz-save]', { code: code ?? 'UNKNOWN', name: (error as Error).name });
    return NextResponse.json({ error: { code: status === 503 ? 'SAVE_RETRYABLE' : code === 'INVALID_CITATION' ? code : status === 409 ? 'CONFLICT' : status === 401 ? 'UNAUTHORIZED' : 'SAVE_ERROR', message } }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '2' } : {}) } });
  }
}
