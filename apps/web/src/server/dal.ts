import { randomBytes, randomUUID } from 'node:crypto';
import { db, transaction } from '@studyforge/db';
import {
  attemptDeadline,
  isExpired,
  studentQuestions,
  decodeAnswers,
  grade,
} from '@studyforge/core';
import type {
  UserDTO,
  DocumentDTO,
  QuizSnapshot,
  FullQuestionDTO,
  AnswerMap,
  AttemptGradedResultDTO,
} from '@studyforge/contracts';

export class DalError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'EXPIRED', message: string) {
    super(message);
    this.name = 'DalError';
  }
}

// ==================== DOCUMENTS DAL ====================

export async function listUserDocuments(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    db.document.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        fileType: true,
        size: true,
        status: true,
        createdAt: true,
      },
    }),
    db.document.count({ where: { ownerId: userId } }),
  ]);

  return {
    items: items.map(d => ({
      ...d,
      status: d.status as DocumentDTO['status'],
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  };
}

export async function getOwnedDocument(userId: string, documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: userId },
    include: {
      chunks: {
        orderBy: { chunkIndex: 'asc' },
      },
    },
  });

  if (!doc) {
    throw new DalError('NOT_FOUND', 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập');
  }

  return {
    id: doc.id,
    title: doc.title,
    fileType: doc.fileType,
    size: doc.size,
    status: doc.status as DocumentDTO['status'],
    rawText: doc.rawText,
    chunks: doc.chunks.map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      pageNumber: c.pageNumber,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function updateOwnedDocument(userId: string, documentId: string, updates: { title?: string; rawText?: string }) {
  const existing = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!existing) throw new DalError('NOT_FOUND', 'Tài liệu không tồn tại');

  const updated = await db.document.update({
    where: { id: documentId },
    data: {
      ...(updates.title ? { title: updates.title } : {}),
      ...(updates.rawText !== undefined ? { rawText: updates.rawText, revision: { increment: 1 } } : {}),
    },
  });

  return updated;
}

// ==================== QUIZZES DAL ====================

export async function listUserQuizzes(userId: string) {
  const quizzes = await db.quiz.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      isPublished: true,
      durationMinutes: true,
      shareCode: true,
      createdAt: true,
    },
  });

  return quizzes.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    isPublished: q.isPublished,
    durationMinutes: q.durationMinutes,
    shareCode: q.shareCode,
    createdAt: q.createdAt.toISOString(),
  }));
}

export async function getOwnedQuiz(userId: string, quizId: string) {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, ownerId: userId },
    include: {
      bank: {
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: {
              options: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
    },
  });

  if (!quiz) throw new DalError('NOT_FOUND', 'Bài kiểm tra không tồn tại hoặc bạn không có quyền truy cập');

  const questions: FullQuestionDTO[] = quiz.bank.questions.map(q => ({
    id: q.id,
    type: q.type as any,
    stem: q.stem,
    options: q.options.map(o => ({ id: o.id, text: o.text })),
    correctOptionIds: q.correctOptionIds as string[],
    acceptedAnswers: q.acceptedAnswers as string[],
    explanation: q.explanation,
    points: q.points,
    difficulty: q.difficulty as any,
    topic: q.topic,
    answerOrigin: q.answerOrigin as any,
    sourceRefs: q.sourceRefs as any,
    reviewed: q.reviewed,
  }));

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    durationMinutes: quiz.durationMinutes,
    isPublished: quiz.isPublished,
    shareCode: quiz.shareCode,
    createdAt: quiz.createdAt.toISOString(),
    questions,
  };
}

export async function publishOwnedQuiz(
  userId: string,
  quizId: string,
  options: { durationMinutes?: number; deadline?: string; allowReview: boolean }
) {
  return transaction(async tx => {
    const quiz = await tx.quiz.findFirst({
      where: { id: quizId, ownerId: userId },
      include: {
        bank: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: { options: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
    });

    if (!quiz) throw new DalError('NOT_FOUND', 'Bài kiểm tra không tồn tại');
    if (!quiz.bank.questions.length) throw new DalError('CONFLICT', 'Không thể xuất bản đề thi chưa có câu hỏi');

    const nextVersion = quiz.publishedVersion + 1;
    const shareCode = quiz.shareCode || randomBytes(16).toString('hex');
    const deadlineDate = options.deadline ? new Date(options.deadline) : null;
    const duration = options.durationMinutes ?? quiz.durationMinutes;

    const questions: FullQuestionDTO[] = quiz.bank.questions.map(q => ({
      id: q.id,
      type: q.type as any,
      stem: q.stem,
      options: q.options.map(o => ({ id: o.id, text: o.text })),
      correctOptionIds: q.correctOptionIds as string[],
      acceptedAnswers: q.acceptedAnswers as string[],
      explanation: q.explanation,
      points: q.points,
      difficulty: q.difficulty as any,
      topic: q.topic,
      answerOrigin: q.answerOrigin as any,
      sourceRefs: q.sourceRefs as any,
      reviewed: q.reviewed,
    }));

    const snapshot: QuizSnapshot = {
      title: quiz.title,
      description: quiz.description,
      durationMinutes: duration,
      deadline: deadlineDate ? deadlineDate.toISOString() : null,
      allowReview: options.allowReview,
      questions,
    };

    const version = await tx.quizVersion.create({
      data: {
        quizId: quiz.id,
        version: nextVersion,
        snapshot: snapshot as any,
      },
    });

    await tx.quiz.update({
      where: { id: quiz.id },
      data: {
        isPublished: true,
        shareCode,
        durationMinutes: duration,
        deadline: deadlineDate,
        allowReview: options.allowReview,
        publishedVersion: nextVersion,
      },
    });

    return {
      versionId: version.id,
      versionNumber: nextVersion,
      shareCode,
    };
  });
}

// ==================== EXAM ATTEMPTS DAL (ZERO LEAK) ====================

export async function startQuizAttempt(user: UserDTO, params: { quizId?: string; shareCode?: string }) {
  const quiz = await db.quiz.findFirst({
    where: {
      ...(params.shareCode ? { shareCode: params.shareCode } : { id: params.quizId }),
      isPublished: true,
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!quiz || !quiz.versions.length) {
    throw new DalError('NOT_FOUND', 'Đề thi không tồn tại hoặc chưa được phát hành');
  }

  const latestVersion = quiz.versions[0];
  const snapshot = latestVersion.snapshot as unknown as QuizSnapshot;

  const now = new Date();
  if (snapshot.deadline && new Date(snapshot.deadline).getTime() <= now.getTime()) {
    throw new DalError('EXPIRED', 'Đề thi đã quá thời hạn làm bài');
  }

  // Check if student already started an attempt for this version
  const existingAttempt = await db.attempt.findUnique({
    where: {
      userId_quizVersionId: {
        userId: user.id,
        quizVersionId: latestVersion.id,
      },
    },
    include: { answers: true },
  });

  if (existingAttempt) {
    const questions = studentQuestions(snapshot, existingAttempt.seed);
    return {
      attemptId: existingAttempt.id,
      quizTitle: snapshot.title,
      durationMinutes: snapshot.durationMinutes,
      startedAt: existingAttempt.startedAt.toISOString(),
      expiresAt: existingAttempt.expiresAt.toISOString(),
      questions,
      isSubmitted: existingAttempt.status === 'submitted',
    };
  }

  const seed = randomBytes(32).toString('hex');
  const startedAt = now;
  const expiresAt = attemptDeadline(startedAt, snapshot.durationMinutes, snapshot.deadline ? new Date(snapshot.deadline) : null);

  const attempt = await db.attempt.create({
    data: {
      userId: user.id,
      quizId: quiz.id,
      quizVersionId: latestVersion.id,
      seed,
      startedAt,
      expiresAt,
      status: 'started',
    },
  });

  // CRITICAL SECURITY: Generate randomized questions for student without answers or explanations!
  const questions = studentQuestions(snapshot, seed);

  return {
    attemptId: attempt.id,
    quizTitle: snapshot.title,
    durationMinutes: snapshot.durationMinutes,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    questions,
    isSubmitted: false,
  };
}

export async function saveAttemptAnswers(userId: string, attemptId: string, answers: AnswerMap) {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
  });

  if (!attempt) throw new DalError('NOT_FOUND', 'Lượt làm bài không tồn tại');
  if (attempt.status === 'submitted') throw new DalError('CONFLICT', 'Bài thi đã được nộp');
  if (isExpired(attempt.expiresAt)) throw new DalError('EXPIRED', 'Thời gian làm bài đã kết thúc');

  for (const [questionId, values] of Object.entries(answers)) {
    await db.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      create: {
        attemptId,
        questionId,
        values: values as any,
      },
      update: {
        values: values as any,
        savedAt: new Date(),
      },
    });
  }

  return { savedAt: new Date().toISOString(), status: 'saved' };
}

export async function submitQuizAttempt(userId: string, attemptId: string, answers?: AnswerMap) {
  return transaction(async tx => {
    const attempt = await tx.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        quizVersion: true,
        answers: true,
      },
    });

    if (!attempt) throw new DalError('NOT_FOUND', 'Lượt làm bài không tồn tại');
    if (attempt.status === 'submitted') {
      // Idempotent: return existing grade
      return {
        attemptId: attempt.id,
        submittedAt: attempt.submittedAt?.toISOString() || attempt.startedAt.toISOString(),
        score: attempt.score ?? 0,
        totalPoints: attempt.totalPoints ?? 0,
        passed: attempt.passed ?? false,
      };
    }

    const snapshot = attempt.quizVersion.snapshot as unknown as QuizSnapshot;

    // Merge answers from database and submitted argument
    const answerMap: AnswerMap = {};
    for (const a of attempt.answers) {
      answerMap[a.questionId] = a.values as string[];
    }
    if (answers) {
      Object.assign(answerMap, answers);
    }

    // Decode student answers from transient IDs to real IDs
    const decodedAnswers = decodeAnswers(snapshot, attempt.seed, answerMap);

    // Grade using core domain logic
    const { score, totalPoints, passed, details } = grade(snapshot.questions, decodedAnswers);

    const now = new Date();
    await tx.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'submitted',
        submittedAt: now,
        score,
        totalPoints,
        passed,
        result: details as any,
      },
    });

    return {
      attemptId: attempt.id,
      submittedAt: now.toISOString(),
      score,
      totalPoints,
      passed,
      details: snapshot.allowReview ? details : undefined,
    };
  });
}
