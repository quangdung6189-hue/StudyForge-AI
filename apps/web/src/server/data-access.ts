import { randomBytes, randomUUID } from 'node:crypto';
import { db, transaction, readWithRetry, Prisma } from '@studyforge/db';
import {
  attemptDeadline,
  isExpired,
  studentQuestions,
  decodeAnswers,
  grade,
  chunkText,
  assertCitations,
} from '@studyforge/core';
import { QuestionListSchema } from '@studyforge/contracts';
import { isPracticeQuiz, practiceFeedback } from './practice';
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

/** DB row → question DTO, including the optional shapes (matching pairs, audio, rubric, tags). */
export function toQuestionDTO(q: {
  id: string; type: string; stem: string; options: { id: string; text: string }[]; correctOptionIds: unknown; acceptedAnswers: unknown;
  explanation: string; points: number; difficulty: string; topic: string; answerOrigin: string; sourceRefs: unknown; reviewed: boolean;
  pairs?: unknown; audioAssetId?: string | null; rubric?: string | null; tags?: unknown;
}): FullQuestionDTO {
  return {
    id: q.id,
    type: q.type as FullQuestionDTO['type'],
    stem: q.stem,
    options: q.options.map(o => ({ id: o.id, text: o.text })),
    correctOptionIds: q.correctOptionIds as string[],
    acceptedAnswers: q.acceptedAnswers as string[],
    explanation: q.explanation,
    points: q.points,
    difficulty: q.difficulty as FullQuestionDTO['difficulty'],
    topic: q.topic,
    answerOrigin: q.answerOrigin as FullQuestionDTO['answerOrigin'],
    sourceRefs: q.sourceRefs as FullQuestionDTO['sourceRefs'],
    reviewed: q.reviewed,
    ...(Array.isArray(q.pairs) && q.pairs.length ? { pairs: q.pairs as NonNullable<FullQuestionDTO['pairs']> } : {}),
    ...(q.audioAssetId ? { audioAssetId: q.audioAssetId } : {}),
    ...(q.rubric ? { rubric: q.rubric } : {}),
    ...(Array.isArray(q.tags) && q.tags.length ? { tags: q.tags as string[] } : {}),
  };
}

// ==================== DOCUMENTS DAL ====================

export async function listUserDocuments(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await readWithRetry(() => Promise.all([
    db.document.findMany({
      where: { ownerId: userId, NOT: [{ storageKey: { startsWith: 'editor:' } }, { storageKey: { startsWith: 'editor-source:' } }] },
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
    db.document.count({ where: { ownerId: userId, NOT: [{ storageKey: { startsWith: 'editor:' } }, { storageKey: { startsWith: 'editor-source:' } }] } }),
  ]));

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
  const doc = await readWithRetry(() => db.document.findFirst({
    where: { id: documentId, ownerId: userId },
    include: {
      chunks: {
        orderBy: { chunkIndex: 'asc' },
      },
    },
  }));

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
    revision: doc.revision,
    chunks: doc.chunks.map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      pageNumber: c.pageNumber,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function updateOwnedDocument(userId: string, documentId: string, updates: { title?: string; rawText?: string }, expectedRevision?: number) {
  const existing = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!existing) throw new DalError('NOT_FOUND', 'Tài liệu không tồn tại');
  if (existing.storageKey.startsWith('editor-source:') || existing.storageKey.startsWith('editor:')) throw new DalError('CONFLICT', 'Nguồn biên soạn được bảo vệ. Hãy chỉnh bản nháp trong Trình biên soạn đề thi.');

  return transaction(async tx => {
    const current = await tx.document.findFirst({ where: { id: documentId, ownerId: userId }, select: { revision: true } });
    if (!current) throw new DalError('NOT_FOUND', 'Tài liệu không tồn tại');
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new DalError('CONFLICT', 'Tài liệu đã thay đổi ở nơi khác. Hãy tải lại và đối chiếu trước khi lưu.');
    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        ...(updates.title ? { title: updates.title } : {}),
        ...(updates.rawText !== undefined ? { rawText: updates.rawText, status: updates.rawText.trim().length >= 10 ? 'ready' : 'needs_ocr', revision: { increment: 1 } } : {}),
      },
    });

    if (updates.rawText !== undefined) {
      await tx.documentChunk.deleteMany({ where: { documentId } });
      const newChunks = chunkText(updates.rawText, 1800, 250);
      await tx.documentChunk.createMany({
        data: newChunks.map((c, i) => ({
          documentId,
          chunkIndex: i,
          content: c.content,
          pageNumber: c.pageNumber ?? 1,
        })),
      });
    }

    return updated;
  });
}

export async function deleteOwnedDocument(userId: string, documentId: string) {
  const existing = await db.document.findFirst({
    where: { id: documentId, ownerId: userId },
    include: {
      banks: {
        include: {
          quiz: {
            include: {
              attempts: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new DalError('NOT_FOUND', 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập');
  }

  if (existing.storageKey.startsWith('editor-source:') || existing.storageKey.startsWith('editor:')) {
    throw new DalError('CONFLICT', 'Bản thảo biên soạn được bảo vệ. Hãy xóa từ Trình biên soạn đề thi.');
  }

  const hasAttempts = existing.banks.some(b => b.quiz?.attempts && b.quiz.attempts.length > 0);
  if (hasAttempts) {
    throw new DalError(
      'CONFLICT',
      'Tài liệu này đã được dùng để tạo đề thi có học sinh làm bài. Không thể xóa để bảo toàn kết quả thi.'
    );
  }

  return transaction(async tx => {
    for (const bank of existing.banks) {
      if (bank.quiz) {
        await tx.quizVersion.deleteMany({ where: { quizId: bank.quiz.id } });
        await tx.quiz.delete({ where: { id: bank.quiz.id } });
      }
      await tx.questionOption.deleteMany({ where: { question: { bankId: bank.id } } });
      await tx.question.deleteMany({ where: { bankId: bank.id } });
      await tx.questionBank.delete({ where: { id: bank.id } });
    }

    await tx.documentChunk.deleteMany({ where: { documentId } });
    await tx.documentFile.deleteMany({ where: { documentId } });
    await tx.document.delete({ where: { id: documentId } });

    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const root = process.env.STUDYFORGE_ROOT ?? process.cwd();
      const metaFile = path.join(root, '.data', 'document-extraction', `${documentId}.json`);
      await fs.unlink(metaFile);
    } catch {}

    if (!existing.storageKey.startsWith('db:')) {
      try {
        const { documentStorage } = await import('./document-files');
        await documentStorage().discardUpload({ id: userId }, existing.storageKey);
      } catch {}
    }

    return { id: documentId, success: true };
  });
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
      allowReview: true,
      deadline: true,
      opensAt: true,
      maxAttempts: true,
      createdAt: true,
    },
  });

  return quizzes.map(q => ({
    opensAt: q.opensAt ? q.opensAt.toISOString() : null,
    maxAttempts: q.maxAttempts,
    id: q.id,
    title: q.title,
    description: q.description,
    isPublished: q.isPublished,
    durationMinutes: q.durationMinutes,
    shareCode: q.shareCode,
    allowReview: q.allowReview,
    deadline: q.deadline ? q.deadline.toISOString() : null,
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

  const questions: FullQuestionDTO[] = quiz.bank.questions.map(toQuestionDTO);

  return {
    id: quiz.id,
    documentId: quiz.bank.documentId,
    title: quiz.title,
    description: quiz.description,
    durationMinutes: quiz.durationMinutes,
    isPublished: quiz.isPublished,
    shareCode: quiz.shareCode,
    allowReview: quiz.allowReview,
    opensAt: quiz.opensAt ? quiz.opensAt.toISOString() : null,
    maxAttempts: quiz.maxAttempts,
    createdAt: quiz.createdAt.toISOString(),
    questions,
  };
}

export async function updateOwnedQuizQuestions(
  userId: string,
  quizId: string,
  questions: FullQuestionDTO[],
  settings?: { title?: string; durationMinutes?: number }
) {
  QuestionListSchema.parse(questions);
  return transaction(async tx => {
    const quiz = await tx.quiz.findFirst({
      where: { id: quizId, ownerId: userId },
      include: { bank: true },
    });
    if (!quiz) throw new DalError('NOT_FOUND', 'Bài kiểm tra không tồn tại');
    if (quiz.isPublished) throw new DalError('CONFLICT', 'Không thể sửa bài kiểm tra đã xuất bản');

    const chunks = await tx.documentChunk.findMany({ where: { documentId: quiz.bank.documentId } });
    assertCitations(questions, chunks);

    await tx.questionOption.deleteMany({
      where: { question: { bankId: quiz.bankId } },
    });
    await tx.question.deleteMany({
      where: { bankId: quiz.bankId },
    });

    await tx.question.createMany({ data: questions.map(({ options, ...q }, position) => ({ ...q, bankId: quiz.bankId, position })) as any });
    const options = questions.flatMap(q => q.options.map((option, position) => ({ ...option, questionId: q.id, position })));
    if (options.length) await tx.questionOption.createMany({ data: options });
    if (settings) await tx.quiz.update({ where: { id: quiz.id }, data: settings });

    return { success: true };
  });
}

export async function updateOwnedQuizSettings(
  userId: string,
  quizId: string,
  settings: {
    title?: string;
    description?: string;
    durationMinutes?: number;
    allowReview?: boolean;
    deadline?: string | null;
    isPublished?: boolean;
    mode?: 'exam' | 'practice';
    opensAt?: string | null;
    maxAttempts?: number | null;
  }
) {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, ownerId: userId },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!quiz) throw new DalError('NOT_FOUND', 'Bài kiểm tra không tồn tại');

  let updatedDescription = settings.description !== undefined ? settings.description : quiz.description;
  if (settings.mode) {
    const cleanDesc = updatedDescription.replace(/\[mode:(?:exam|practice)\]\s*/g, '');
    updatedDescription = settings.mode === 'practice' ? `[mode:practice] ${cleanDesc}`.trim() : cleanDesc;
  }

  const updateData: any = {};
  if (settings.title !== undefined) updateData.title = settings.title.trim();
  if (updatedDescription !== undefined) updateData.description = updatedDescription;
  if (settings.durationMinutes !== undefined) updateData.durationMinutes = settings.durationMinutes;
  if (settings.allowReview !== undefined) updateData.allowReview = settings.allowReview;
  if (settings.deadline !== undefined) updateData.deadline = settings.deadline ? new Date(settings.deadline) : null;
  if (settings.isPublished !== undefined) updateData.isPublished = settings.isPublished;
  if (settings.opensAt !== undefined) updateData.opensAt = settings.opensAt ? new Date(settings.opensAt) : null;
  if (settings.maxAttempts !== undefined) updateData.maxAttempts = settings.maxAttempts && settings.maxAttempts > 0 ? settings.maxAttempts : null;

  const updated = await db.quiz.update({
    where: { id: quiz.id },
    data: updateData,
  });

  if (quiz.versions.length > 0) {
    const latestVersion = quiz.versions[0];
    const oldSnapshot = latestVersion.snapshot as unknown as QuizSnapshot;
    const newSnapshot: QuizSnapshot = {
      ...oldSnapshot,
      title: updateData.title ?? oldSnapshot.title,
      description: updateData.description ?? oldSnapshot.description,
      durationMinutes: updateData.durationMinutes ?? oldSnapshot.durationMinutes,
      deadline: updateData.deadline !== undefined ? (updateData.deadline ? updateData.deadline.toISOString() : null) : oldSnapshot.deadline,
      allowReview: updateData.allowReview !== undefined ? updateData.allowReview : oldSnapshot.allowReview,
    };
    await db.quizVersion.update({
      where: { id: latestVersion.id },
      data: { snapshot: newSnapshot as any },
    });
  }

  return updated;
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
    if (quiz.isPublished && quiz.shareCode && quiz.durationMinutes === (options.durationMinutes ?? quiz.durationMinutes) && quiz.allowReview === options.allowReview && (quiz.deadline?.toISOString() ?? null) === (options.deadline ?? null)) {
      const version = await tx.quizVersion.findUnique({ where: { quizId_version: { quizId, version: quiz.publishedVersion } } });
      if (version) return { versionId: version.id, versionNumber: quiz.publishedVersion, shareCode: quiz.shareCode };
    }
    if (quiz.bank.questions.some(q => !q.reviewed)) throw new DalError('CONFLICT', 'Hãy duyệt đáp án và lời giải của tất cả câu hỏi trước khi xuất bản');

    const nextVersion = quiz.publishedVersion + 1;
    const shareCode = (quiz.shareCode || randomBytes(8).toString('hex')).toUpperCase();
    const deadlineDate = options.deadline ? new Date(options.deadline) : null;
    const duration = options.durationMinutes ?? quiz.durationMinutes;

    const questions: FullQuestionDTO[] = quiz.bank.questions.map(toQuestionDTO);

    if (!QuestionListSchema.safeParse(questions).success) throw new DalError('CONFLICT', 'Câu hỏi hoặc đáp án chưa hợp lệ');
    const chunks = await tx.documentChunk.findMany({ where: { documentId: quiz.bank.documentId } });
    try { assertCitations(questions, chunks); } catch { throw new DalError('CONFLICT', 'Trích dẫn không khớp tài liệu hiện tại'); }

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

export async function startQuizAttempt(user: UserDTO, params: { quizId?: string; shareCode?: string; retry?: boolean }) {
  const cleanShareCode = typeof params.shareCode === 'string' ? params.shareCode.trim().toUpperCase() : undefined;
  const cleanQuizId = typeof params.quizId === 'string' ? params.quizId.trim() : undefined;

  if (!cleanShareCode && !cleanQuizId) {
    throw new DalError('NOT_FOUND', 'Cần cung cấp mã chia sẻ hoặc ID bài kiểm tra');
  }

  const quiz = await db.quiz.findFirst({
    where: {
      ...(cleanShareCode ? { shareCode: cleanShareCode } : { id: cleanQuizId }),
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
  const isPracticeMode = isPracticeQuiz(quiz.description, snapshot);

  const now = new Date();
  if (snapshot.deadline && new Date(snapshot.deadline).getTime() <= now.getTime()) {
    throw new DalError('EXPIRED', 'Đề thi đã quá thời hạn làm bài');
  }
  if (quiz.opensAt && quiz.opensAt.getTime() > now.getTime()) {
    const opens = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(quiz.opensAt);
    throw new DalError('FORBIDDEN', `Phòng thi sẽ mở lúc ${opens}.`);
  }
  const attemptsUsed = await db.attemptRecord.count({ where: { userId: user.id, quizId: quiz.id } });
  const limitReached = quiz.maxAttempts != null && attemptsUsed >= quiz.maxAttempts;
  const limits = { maxAttempts: quiz.maxAttempts, attemptsUsed };

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
    if (params.retry && existingAttempt.status === 'submitted' && limitReached) {
      throw new DalError('CONFLICT', `Bạn đã dùng hết ${quiz.maxAttempts} lượt làm bài của đề này.`);
    }
    // If student already submitted and requested retry (or in practice mode, while attempts remain):
    if ((params.retry || isPracticeMode) && existingAttempt.status === 'submitted' && !limitReached) {
      await db.attemptAnswer.deleteMany({ where: { attemptId: existingAttempt.id } });
      const newSeed = randomBytes(32).toString('hex');
      const startedAt = now;
      const expiresAt = attemptDeadline(startedAt, snapshot.durationMinutes, snapshot.deadline ? new Date(snapshot.deadline) : null);
      const retried = await db.attempt.update({
        where: { id: existingAttempt.id },
        data: {
          seed: newSeed,
          startedAt,
          expiresAt,
          status: 'started',
          score: null,
          totalPoints: null,
          passed: null,
          result: Prisma.DbNull,
          submittedAt: null,
        },
        include: { answers: true },
      });
      const questions = studentQuestions(snapshot, newSeed);
      return {
        attemptId: retried.id,
        quizTitle: snapshot.title,
        durationMinutes: snapshot.durationMinutes,
        startedAt: retried.startedAt.toISOString(),
        expiresAt: retried.expiresAt.toISOString(),
        questions,
        answers: {},
        isSubmitted: false,
        isPracticeMode,
        ...limits,
      };
    }

    const questions = studentQuestions(snapshot, existingAttempt.seed);
    const answers: AnswerMap = {};
    const checked: Record<string, ReturnType<typeof practiceFeedback>> = {};
    for (const a of existingAttempt.answers) {
      answers[a.questionId] = a.values as string[];
      if (isPracticeMode && a.checkedAt && existingAttempt.status !== 'submitted') {
        try { checked[a.questionId] = practiceFeedback(snapshot, existingAttempt.seed, a.questionId, a.values as string[]); } catch {}
      }
    }
    return {
      attemptId: existingAttempt.id,
      quizTitle: snapshot.title,
      durationMinutes: snapshot.durationMinutes,
      startedAt: existingAttempt.startedAt.toISOString(),
      expiresAt: existingAttempt.expiresAt.toISOString(),
      questions,
      answers,
      isSubmitted: existingAttempt.status === 'submitted',
      score: existingAttempt.score ?? undefined,
      totalPoints: existingAttempt.totalPoints ?? undefined,
      passed: existingAttempt.passed ?? undefined,
      details: (existingAttempt.status === 'submitted' && snapshot.allowReview) ? (existingAttempt.result as any) : undefined,
      isPracticeMode,
      checked,
      ...limits,
    };
  }

  if (limitReached) throw new DalError('CONFLICT', `Bạn đã dùng hết ${quiz.maxAttempts} lượt làm bài của đề này.`);

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
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    questions,
    answers: {},
    isSubmitted: false,
    isPracticeMode,
    ...limits,
  };
}

export async function saveAttemptAnswers(userId: string, attemptId: string, answers: AnswerMap) {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
    include: { quizVersion: true },
  });

  if (!attempt) throw new DalError('NOT_FOUND', 'Lượt làm bài không tồn tại');
  if (attempt.status === 'submitted') throw new DalError('CONFLICT', 'Bài thi đã được nộp');
  if (isExpired(attempt.expiresAt)) throw new DalError('EXPIRED', 'Thời gian làm bài đã kết thúc');

  const snapshot = attempt.quizVersion.snapshot as unknown as QuizSnapshot;
  const validQuestionIds = new Set(
    studentQuestions(snapshot, attempt.seed).map(q => q.id)
  );

  const locked = new Set((await db.attemptAnswer.findMany({ where: { attemptId, checkedAt: { not: null } }, select: { questionId: true } })).map(a => a.questionId));
  const operations = [];
  const now = new Date();
  for (const [questionId, values] of Object.entries(answers)) {
    if (!validQuestionIds.has(questionId) || locked.has(questionId)) {
      continue; // Unknown ids never poison the attempt; checked practice answers stay locked
    }
    const valArray = Array.isArray(values) ? values : [String(values)];
    operations.push(
      db.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId,
          },
        },
        create: {
          attemptId,
          questionId,
          values: valArray,
          savedAt: now,
        },
        update: {
          values: valArray,
          savedAt: now,
        },
      })
    );
  }

  if (operations.length > 0) {
    await db.$transaction(operations);
  }

  return { savedAt: now.toISOString(), status: 'saved' };
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
    const snapshot = attempt.quizVersion.snapshot as unknown as QuizSnapshot;

    if (attempt.status === 'submitted') {
      // Idempotent: return existing grade with details if review policy allows
      return {
        attemptId: attempt.id,
        submittedAt: attempt.submittedAt?.toISOString() || attempt.startedAt.toISOString(),
        score: attempt.score ?? 0,
        totalPoints: attempt.totalPoints ?? 0,
        passed: attempt.passed ?? false,
        details: snapshot.allowReview ? (attempt.result as any) : undefined,
      };
    }

    const now = new Date();
    const expired = isExpired(attempt.expiresAt, now);

    // Merge answers from database and submitted argument (only merge submitted answers if NOT expired)
    const answerMap: AnswerMap = {};
    const locked = new Set<string>();
    for (const a of attempt.answers) {
      answerMap[a.questionId] = a.values as string[];
      if (a.checkedAt) locked.add(a.questionId);
    }
    if (answers && !expired) {
      for (const [questionId, values] of Object.entries(answers)) if (!locked.has(questionId)) answerMap[questionId] = values;
    }

    // Decode student answers from transient IDs to real IDs
    const decodedAnswers = decodeAnswers(snapshot, attempt.seed, answerMap);

    // Grade using core domain logic
    const { score, totalPoints, passed, details } = grade(snapshot.questions, decodedAnswers);

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

    // Immutable history row: retries reuse the Attempt, never this record.
    const record = await tx.attemptRecord.create({
      data: {
        attemptId: attempt.id,
        userId,
        quizId: attempt.quizId,
        quizVersionId: attempt.quizVersionId,
        score,
        totalPoints,
        passed,
        startedAt: attempt.startedAt,
        submittedAt: now,
        answers: decodedAnswers as any,
        result: details as any,
      },
    });

    return {
      attemptId: attempt.id,
      recordId: record.id,
      submittedAt: now.toISOString(),
      score,
      totalPoints,
      passed,
      details: snapshot.allowReview ? details : undefined,
    };
  });
}
