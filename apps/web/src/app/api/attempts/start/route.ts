import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { startQuizAttempt } from '@/server/dal';
import { AttemptStartSchema } from '@studyforge/contracts';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rawBody = await req.json().catch(() => ({}));
    const parse = AttemptStartSchema.safeParse(rawBody);

    if (!parse.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Mã đề thi hoặc ID không hợp lệ' } }, { status: 400 });
    }

    const { quizId, shareCode } = parse.data;
    const attempt = await startQuizAttempt(user, { quizId, shareCode });
    return NextResponse.json(attempt);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : err.code === 'EXPIRED' ? 410 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
