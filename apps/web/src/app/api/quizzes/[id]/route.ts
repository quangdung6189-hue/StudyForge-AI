import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getOwnedQuiz, updateOwnedQuizQuestions, updateOwnedQuizSettings } from '@/server/dal';
import { QuestionListSchema } from '@studyforge/contracts';
const QuizUpdateSchema = z.object({
  questions: QuestionListSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  allowReview: z.boolean().optional(),
  deadline: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  mode: z.enum(['exam', 'practice']).optional(),
}).refine(data => Object.keys(data).length > 0, 'No update fields provided');
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return NextResponse.json(await getOwnedQuiz(user.id, (await context.params).id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch(error) { return failure(error); }
}
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => ({}));
    const parsed = QuizUpdateSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu cập nhật chưa hợp lệ.' } }, { status: 400 });
    const quizId = (await context.params).id;
    if (parsed.data.questions) {
      await updateOwnedQuizQuestions(user.id, quizId, parsed.data.questions, {
        title: parsed.data.title,
        durationMinutes: parsed.data.durationMinutes,
      });
    } else {
      await updateOwnedQuizSettings(user.id, quizId, {
        title: parsed.data.title,
        description: parsed.data.description,
        durationMinutes: parsed.data.durationMinutes,
        allowReview: parsed.data.allowReview,
        deadline: parsed.data.deadline,
        isPublished: parsed.data.isPublished,
        mode: parsed.data.mode,
      });
    }
    return NextResponse.json({ success: true });
  } catch(error) { return failure(error); }
}
function failure(error: unknown) {
 const code = (error as { code?: string }).code;
 const status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : 500;
 return NextResponse.json({ error: { code: status === 500 ? 'QUIZ_ERROR' : code, message: status === 401 ? 'Bạn cần đăng nhập.' : status === 404 ? 'Không tìm thấy đề của bạn.' : status === 409 ? (error as Error).message || 'Đề đã xuất bản; không thể sửa nội dung câu hỏi.' : 'Chưa xử lý được đề. Hãy thử lại.' } }, { status });
}
