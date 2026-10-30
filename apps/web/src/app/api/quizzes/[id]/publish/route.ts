import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { publishOwnedQuiz } from '@/server/dal';
import { QuizPublishSchema } from '@studyforge/contracts';
import { isTransientDatabaseError } from '@studyforge/db';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const rawBody = await req.json().catch(() => ({}));

    // Handle string booleans or raw objects safely
    const normalizedBody = {
      ...rawBody,
      allowReview: typeof rawBody.allowReview === 'string' ? rawBody.allowReview === 'true' : Boolean(rawBody.allowReview ?? true),
      durationMinutes: rawBody.durationMinutes !== undefined ? Number(rawBody.durationMinutes) : undefined,
    };

    const parse = QuizPublishSchema.safeParse(normalizedBody);
    if (!parse.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu xuất bản không hợp lệ' } }, { status: 400 });
    }

    const result = await publishOwnedQuiz(user.id, id, {
      durationMinutes: parse.data.durationMinutes,
      deadline: parse.data.deadline,
      allowReview: parse.data.allowReview,
    });

    const origin = new URL(req.url).origin;
    const shareUrl = `${origin}/quizzes/take?code=${result.shareCode}`;

    return NextResponse.json({
      success: true,
      versionId: result.versionId,
      versionNumber: result.versionNumber,
      shareCode: result.shareCode,
      shareUrl,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : isTransientDatabaseError(error) || code === 'P2028' ? 503 : 500;
    return NextResponse.json({ error: { code: status === 503 ? 'PUBLISH_RETRYABLE' : status < 500 ? code : 'PUBLISH_ERROR', message: status === 401 ? 'Bạn cần đăng nhập lại.' : status === 404 ? 'Không tìm thấy đề của bạn.' : status === 409 ? (error as Error).message : 'Chưa xuất bản được. Bản nháp đã lưu; hãy bấm xuất bản lại.' } }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '2' } : {}) } });
  }
}
