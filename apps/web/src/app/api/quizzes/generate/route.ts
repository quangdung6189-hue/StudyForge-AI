import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getOwnedDocument } from '@/server/dal';
import { generateQuizQuestions } from '@/server/generator';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { documentId, mode, questionCount, types, difficultyDistribution } = body;

    if (!documentId) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Thiếu mã tài liệu' } }, { status: 400 });
    }

    const doc = await getOwnedDocument(user.id, documentId);

    const questions = await generateQuizQuestions({
      documentTitle: doc.title,
      chunks: doc.chunks,
      mode: mode || 'ai_generate',
      questionCount: Number(questionCount) || 5,
      types: types && types.length ? types : ['single'],
      difficultyDistribution,
    });

    return NextResponse.json({
      success: true,
      documentTitle: doc.title,
      questions,
    });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : err.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: { code: err.code || 'GENERATE_ERROR', message: err.message } }, { status });
  }
}
