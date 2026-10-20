import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@studyforge/db';
import { hashPassword, verifyPassword, createSession } from '../apps/web/src/server/auth';
import {
  listUserDocuments,
  getOwnedDocument,
  publishOwnedQuiz,
  startQuizAttempt,
  saveAttemptAnswers,
  submitQuizAttempt,
} from '../apps/web/src/server/dal';

describe('Auth & DAL Integration Tests', () => {
  let teacherId: string;
  let studentId: string;
  let intruderId: string;
  let documentId: string;
  let quizId: string;

  beforeAll(async () => {
    // Clean up test records
    await db.attempt.deleteMany();
    await db.quizVersion.deleteMany();
    await db.quiz.deleteMany();
    await db.question.deleteMany();
    await db.questionBank.deleteMany();
    await db.documentChunk.deleteMany();
    await db.document.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();

    const tPw = await hashPassword('TeacherSecurePass123!');
    const sPw = await hashPassword('StudentSecurePass123!');
    const iPw = await hashPassword('IntruderSecurePass123!');

    const teacher = await db.user.create({
      data: { email: 'teacher@test.com', name: 'Giáo viên A', passwordHash: tPw, role: 'teacher' },
    });
    teacherId = teacher.id;

    const student = await db.user.create({
      data: { email: 'student@test.com', name: 'Học sinh B', passwordHash: sPw, role: 'student' },
    });
    studentId = student.id;

    const intruder = await db.user.create({
      data: { email: 'intruder@test.com', name: 'Người ngoài C', passwordHash: iPw, role: 'student' },
    });
    intruderId = intruder.id;

    // Create a document for teacher
    const doc = await db.document.create({
      data: {
        ownerId: teacherId,
        title: 'Tài liệu Sinh học 8',
        fileType: 'application/pdf',
        size: 1024,
        storageKey: `${teacherId}/doc-1`,
        status: 'ready',
        rawText: 'Tế bào là đơn vị cấu trúc cơ bản của cơ thể.',
        chunks: {
          create: [{ chunkIndex: 0, content: 'Tế bào là đơn vị cấu trúc cơ bản của cơ thể.', pageNumber: 1 }],
        },
      },
    });
    documentId = doc.id;

    // Create question bank & quiz
    const bank = await db.questionBank.create({
      data: {
        ownerId: teacherId,
        documentId,
        title: 'Ngân hàng Sinh học 8',
        questions: {
          create: [
            {
              position: 0,
              type: 'single',
              stem: 'Đơn vị cấu trúc cơ bản của cơ thể sinh vật là gì?',
              points: 10,
              difficulty: 'recognition',
              topic: 'Sinh học',
              answerOrigin: 'document',
              explanation: 'Theo sách giáo khoa Sinh học',
              correctOptionIds: ['opt-1'],
              acceptedAnswers: [],
              sourceRefs: [{ chunkId: 'any', quote: 'Tế bào là đơn vị cấu trúc' }],
              reviewed: true,
              options: {
                create: [
                  { id: 'opt-1', position: 0, text: 'Tế bào' },
                  { id: 'opt-2', position: 1, text: 'Mô' },
                ],
              },
            },
          ],
        },
      },
    });

    const quiz = await db.quiz.create({
      data: {
        ownerId: teacherId,
        bankId: bank.id,
        title: 'Bài kiểm tra 15 phút Sinh học',
        description: 'Kiểm tra chương tế bào',
        durationMinutes: 15,
        isPublished: false,
      },
    });
    quizId = quiz.id;
  });

  it('hashes and verifies passwords securely with bcrypt', async () => {
    const pw = 'MySuperPassword2026!';
    const hash = await hashPassword(pw);
    expect(await verifyPassword(pw, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('creates and validates user sessions', async () => {
    const session = await createSession(teacherId);
    expect(session.token).toHaveLength(64);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('prevents ID-swapping: Intruder cannot access Teacher document', async () => {
    // Teacher can access their document
    const doc = await getOwnedDocument(teacherId, documentId);
    expect(doc.id).toBe(documentId);

    // Intruder gets NOT_FOUND / FORBIDDEN
    await expect(getOwnedDocument(intruderId, documentId)).rejects.toThrow('không tồn tại hoặc bạn không có quyền');
  });

  it('publishes quiz, lets authenticated student take exam without leaking answers, and grades correctly', async () => {
    // 1. Teacher publishes quiz
    const publishRes = await publishOwnedQuiz(teacherId, quizId, {
      durationMinutes: 15,
      allowReview: true,
    });
    expect(publishRes.versionNumber).toBe(1);
    expect(publishRes.shareCode).toBeDefined();

    // 2. Student starts attempt using shareCode
    const studentUser = { id: studentId, email: 'student@test.com', name: 'Học sinh B', role: 'student' as const };
    const attempt = await startQuizAttempt(studentUser, { shareCode: publishRes.shareCode });

    expect(attempt.attemptId).toBeDefined();
    expect(attempt.questions).toHaveLength(1);

    const q = attempt.questions[0];
    expect((q as any).correctOptionIds).toBeUndefined();
    expect((q as any).explanation).toBeUndefined();

    // 3. Student selects the correct answer ("Tế bào")
    const correctOptionTransientId = q.options.find(o => o.text === 'Tế bào')!.id;
    await saveAttemptAnswers(studentId, attempt.attemptId, {
      [q.id]: [correctOptionTransientId],
    });

    // 4. Student submits exam
    const submission = await submitQuizAttempt(studentId, attempt.attemptId, {
      [q.id]: [correctOptionTransientId],
    });

    expect(submission.score).toBe(10);
    expect(submission.totalPoints).toBe(10);
    expect(submission.passed).toBe(true);
    expect(submission.details?.questions[0].correct).toBe(true);

    // 5. Intruder cannot submit or alter Student attempt
    await expect(submitQuizAttempt(intruderId, attempt.attemptId, {})).rejects.toThrow('không tồn tại');
  });
});
