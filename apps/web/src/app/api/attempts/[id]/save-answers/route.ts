import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { saveAttemptAnswers } from '@/server/dal';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json();

    if (!body.answers || typeof body.answers !== 'object') {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu câu trả lời không hợp lệ' } }, { status: 400 });
    }

    const result = await saveAttemptAnswers(user.id, id, body.answers);
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : err.code === 'EXPIRED' ? 410 : err.code === 'CONFLICT' ? 409 : 500;
    return NextResponse.json({ error: { code: err.code || 'SAVE_ERROR', message: err.message } }, { status });
  }
}
