import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getOwnedQuiz } from '@/server/dal';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const quiz = await getOwnedQuiz(user.id, id);
    return NextResponse.json(quiz);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
