import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getOwnedQuiz, updateOwnedQuizQuestions } from '@/server/dal';
import { QuestionListSchema } from '@studyforge/contracts';
const EditSchema = z.strictObject({ questions: QuestionListSchema, title: z.string().trim().min(1).max(200), durationMinutes: z.number().int().min(1).max(1440) });
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return NextResponse.json(await getOwnedQuiz(user.id, (await context.params).id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch(error) { return failure(error); }
}
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const parsed = EditSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Nội dung bản nháp chưa hợp lệ. Kiểm tra đáp án và lời giải.' } }, { status: 400 });
    const { questions, title, durationMinutes } = parsed.data;
    await updateOwnedQuizQuestions(user.id, (await context.params).id, questions, { title, durationMinutes });
    return NextResponse.json({ success: true });
  } catch(error) { return failure(error); }
}
function failure(error: unknown) {
 const code = (error as { code?: string }).code;
 const status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : 500;
 return NextResponse.json({ error: { code: status === 500 ? 'QUIZ_ERROR' : code, message: status === 401 ? 'Bạn cần đăng nhập.' : status === 404 ? 'Không tìm thấy đề của bạn.' : status === 409 ? 'Đề đã xuất bản; không thể sửa bản đang phát hành.' : 'Chưa xử lý được bản nháp. Giữ nội dung và thử lại.' } }, { status });
}
