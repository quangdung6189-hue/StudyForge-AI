import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { startQuizAttempt } from '@/server/dal';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { quizId, shareCode } = body;

    if (!quizId && !shareCode) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Cần mã đề thi (shareCode) hoặc mã bài kiểm tra' } }, { status: 400 });
    }

    const attempt = await startQuizAttempt(user, { quizId, shareCode });
    return NextResponse.json(attempt);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : err.code === 'EXPIRED' ? 410 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
