import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { submitQuizAttempt } from '@/server/dal';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    let answers: Record<string, string[]> | undefined;
    try {
      const body = await req.json();
      answers = body.answers;
    } catch {
      // Body may be empty if submitting currently saved answers
    }

    const result = await submitQuizAttempt(user.id, id, answers);
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'SUBMIT_ERROR', message: err.message } }, { status });
  }
}
