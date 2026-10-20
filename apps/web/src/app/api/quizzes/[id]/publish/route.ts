import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { publishOwnedQuiz } from '@/server/dal';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json();

    const result = await publishOwnedQuiz(user.id, id, {
      durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
      deadline: body.deadline,
      allowReview: Boolean(body.allowReview),
    });

    const origin = new URL(req.url).origin;
    const shareUrl = `${origin}/quizzes/take?code=${result.shareCode}`;

    return NextResponse.json({
      success: true,
      shareCode: result.shareCode,
      shareUrl,
      versionNumber: result.versionNumber,
    });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'PUBLISH_ERROR', message: err.message } }, { status });
  }
}
