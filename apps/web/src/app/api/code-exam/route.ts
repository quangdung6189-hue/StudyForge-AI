import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { db } from '@studyforge/db';
import { DalError } from '@/server/dal';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { code, title, durationMinutes = 30, questionCount, shareCode } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Vui lòng nhập mã đề thi.' } }, { status: 400 });
    }

    const questions = parseCodeExam(code, questionCount);

    if (!questions.length) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Không trích xuất được câu hỏi từ mã đề.' } }, { status: 400 });
    }

    const quizId = shareCode || `code-${crypto.randomUUID().slice(0, 12)}`;

    if (shareCode) {
      const existing = await db.quiz.findFirst({ where: { shareCode, ownerId: user.id } });
      if (existing) throw new DalError('CONFLICT', 'Mã đề đã tồn tại. Hãy dùng mã khác.');
    }

    const result = await db.$transaction(async tx => {
      const bank = await tx.questionBank.create({
        data: { ownerId: user.id, documentId: '', title },
      });

      await tx.question.createMany({
        data: questions.map((q, position) => ({ ...q, bankId: bank.id, position })),
      });

      const options = questions.flatMap(q =>
        q.options.map((option: { id: string; text: string }, position: number) => ({ ...option, questionId: q.id, position }))
      );
      if (options.length) await tx.questionOption.createMany({ data: options });

      const quiz = await tx.quiz.create({
        data: {
          id: quizId, ownerId: user.id, bankId: bank.id, title,
          durationMinutes, isPublished: true, shareCode: quizId, publishedVersion: 1,
        },
      });

      return { quiz: { id: quiz.id, title, bankId: bank.id, questionCount: questions.length }, shareCode: quiz.shareCode };
    });

    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === 'UNAUTHORIZED' ? 401 : code === 'CONFLICT' ? 409 : 500;
    const message = status === 401 ? 'Bạn cần đăng nhập.' : status === 409 ? 'Mã đề đã tồn tại.' : 'Không thể tạo đề từ mã.';
    return NextResponse.json({ error: { code: status === 409 ? 'CONFLICT' : 'ERROR', message } }, { status });
  }
}

/**
 * Parse exam code format to extract questions with answers.
 * Supports format like:
 * Câu 1: Nội dung câu hỏi
 * A. Phương án 1
 * B. Phương án 2
 * Đáp án: A
 * ...
 * Or with fill-in/short answers:
 * Câu 2: Nội dung câu trả lời ngắn
 * Đáp án: đáp án mẫu
 */
function parseCodeExam(code: string, limit?: number) {
  const lines = code.split(/\r?\n/);
  const questions: any[] = [];
  let current: any = null;

  const flush = () => {
    if (current && current.stem) {
      questions.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const qMatch = line.match(/^(?:Câu|Question|Câu hỏi)\s*(\d+)[:\.]?\s*(.*)$/i) ||
                   line.match(/^(\d+)[:\.\-]\s+(.+)$/);

    if (qMatch) {
      flush();
      current = {
        id: crypto.randomUUID(),
        stem: qMatch[2]?.trim() || '',
        options: [] as Array<{ id: string; text: string }>,
        correctOptionIds: [] as string[],
        acceptedAnswers: [] as string[],
        type: 'single',
        points: 1,
        difficulty: 'comprehension',
        topic: 'Đề từ mã code',
        answerOrigin: 'teacher' as const,
        reviewed: true,
        sourceRefs: [],
      };
      continue;
    }

    if (!current) continue;

    const ansMatch = line.match(/^(?:Đáp án|Answer|Đáp án đúng)[:\-]\s*(.+)$/i);
    if (ansMatch) {
      const answerText = ansMatch[1].trim();
      const letterMatch = answerText.match(/^[A-F]$/i);
      if (letterMatch && current.options.length > 0) {
        const idx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        if (idx < current.options.length) {
          current.correctOptionIds = [current.options[idx].id];
          current.acceptedAnswers = [];
        }
      } else {
        current.acceptedAnswers = [answerText];
        current.correctOptionIds = [];
        current.type = 'short';
      }
      continue;
    }

    const optMatch = line.match(/^([A-F])[\.\)]\s+(.+)$/i) ||
                     line.match(/^\[([A-F])\]\s+(.+)$/i) ||
                     line.match(/^\(([A-F])\)\s+(.+)$/i);
    if (optMatch) {
      current.options.push({ id: crypto.randomUUID(), text: optMatch[2].trim() });
      continue;
    }

    const cbMatch = line.match(/^\[\s*(x|X)?\s*\]\s+(.+)$/i);
    if (cbMatch) {
      current.options.push({ id: crypto.randomUUID(), text: cbMatch[2].trim() });
      if (cbMatch[1]) {
        current.correctOptionIds = [...current.correctOptionIds, current.options[current.options.length - 1].id];
        current.type = 'multiple';
      }
      continue;
    }

    if (current.stem) {
      current.stem += ' ' + line;
    } else {
      current.stem = line;
    }
  }

  flush();

  for (const q of questions) {
    if (q.options.length === 0 && q.acceptedAnswers.length > 0) {
      q.type = 'short';
    }
    if (q.options.length > 0 && q.correctOptionIds.length === 0 && q.acceptedAnswers.length === 0) {
      q.correctOptionIds = [q.options[0].id];
    }
    if (q.options.length > 1 && q.correctOptionIds.length > 1) {
      q.type = 'multiple';
    }
  }

  return limit ? questions.slice(0, limit) : questions;
}
