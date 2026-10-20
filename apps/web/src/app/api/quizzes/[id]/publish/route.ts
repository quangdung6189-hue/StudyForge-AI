import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { publishOwnedQuiz } from '@/server/dal';
import { QuizPublishSchema } from '@studyforge/contracts';

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
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'PUBLISH_ERROR', message: err.message } }, { status });
  }
}
