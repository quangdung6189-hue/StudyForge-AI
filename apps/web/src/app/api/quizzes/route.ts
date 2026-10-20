import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { requireUser } from '@/server/auth';
import { listUserQuizzes } from '@/server/dal';
import type { FullQuestionDTO } from '@studyforge/contracts';

export async function GET() {
  try {
    const user = await requireUser();
    const quizzes = await listUserQuizzes(user.id);
    return NextResponse.json({ items: quizzes });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { documentId, title, description, durationMinutes, questions } = body;

    if (!documentId || !title || !Array.isArray(questions) || !questions.length) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu đề thi không đầy đủ' } }, { status: 400 });
    }

    // Verify document ownership
    const doc = await db.document.findFirst({ where: { id: documentId, ownerId: user.id } });
    if (!doc) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Tài liệu không tồn tại' } }, { status: 404 });
    }

    // Create Bank and Questions
    const bank = await db.questionBank.create({
      data: {
        ownerId: user.id,
        documentId,
        title,
        questions: {
          create: (questions as FullQuestionDTO[]).map((q, idx) => ({
            position: idx,
            type: q.type,
            stem: q.stem,
            points: q.points || 1,
            difficulty: q.difficulty || 'recognition',
            topic: q.topic || title,
            answerOrigin: q.answerOrigin || 'ai_suggested',
            explanation: q.explanation || '',
            correctOptionIds: q.correctOptionIds || [],
            acceptedAnswers: q.acceptedAnswers || [],
            sourceRefs: q.sourceRefs || [],
            reviewed: q.reviewed ?? true,
            options: {
              create: (q.options || []).map((opt, oIdx) => ({
                id: opt.id,
                position: oIdx,
                text: opt.text,
              })),
            },
          })),
        },
      },
    });

    const quiz = await db.quiz.create({
      data: {
        ownerId: user.id,
        bankId: bank.id,
        title,
        description: description || '',
        durationMinutes: durationMinutes || 30,
        isPublished: false,
      },
    });

    return NextResponse.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        bankId: bank.id,
        questionCount: questions.length,
      },
    });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: { code: err.code || 'ERROR', message: err.message } }, { status });
  }
}
