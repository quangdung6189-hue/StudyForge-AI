import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/auth-dal-test-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`;
  process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  process.env.STUDYFORGE_ROOT = process.cwd();
  return { databaseFile };
});

import { db } from '@studyforge/db';
import { randomUUID } from 'node:crypto';
import { saveQuiz } from '../apps/web/src/server/quiz-save';
import { hashPassword, verifyPassword, createSession } from '../apps/web/src/server/auth';
import {
  listUserDocuments,
  getOwnedDocument,
  publishOwnedQuiz,
  startQuizAttempt,
  saveAttemptAnswers,
  submitQuizAttempt,
  updateOwnedQuizQuestions,
} from '../apps/web/src/server/dal';

describe('Auth & DAL Integration Tests', () => {
  let teacherId: string;
  let studentId: string;
  let intruderId: string;
  let documentId: string;
  let quizId: string;

  beforeAll(async () => {
    const initialized = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], {
      env: process.env, encoding: 'utf8', timeout: 30000,
    });
    if (initialized.status !== 0) throw new Error(`Test database initialization failed: ${initialized.stderr || initialized.stdout}`);
    // Clean up only test records
    const testEmails = ['teacher@test.com', 'student@test.com', 'intruder@test.com'];
    const existingUsers = await db.user.findMany({ where: { email: { in: testEmails } } });
    const userIds = existingUsers.map(u => u.id);
    if (userIds.length > 0) {
      await db.attemptAnswer.deleteMany({ where: { attempt: { userId: { in: userIds } } } }).catch(() => {});
      await db.attempt.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await db.quizVersion.deleteMany({ where: { quiz: { ownerId: { in: userIds } } } }).catch(() => {});
      await db.quiz.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
      await db.questionOption.deleteMany({ where: { question: { bank: { ownerId: { in: userIds } } } } }).catch(() => {});
      await db.question.deleteMany({ where: { bank: { ownerId: { in: userIds } } } }).catch(() => {});
      await db.questionBank.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
      await db.documentChunk.deleteMany({ where: { document: { ownerId: { in: userIds } } } }).catch(() => {});
      await db.document.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
      await db.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }

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
    const chunk = await db.documentChunk.findFirstOrThrow({ where: { documentId } });

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
              correctOptionIds: ['c1000000-0000-4000-8000-000000000001'],
              acceptedAnswers: [],
              sourceRefs: [{ chunkId: chunk.id, quote: 'Tế bào là đơn vị cấu trúc' }],
              reviewed: true,
              options: {
                create: [
                  { id: 'c1000000-0000-4000-8000-000000000001', position: 0, text: 'Tế bào' },
                  { id: 'c1000000-0000-4000-8000-000000000002', position: 1, text: 'Mô' },
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

  afterAll(async () => {
    await db.$disconnect();
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(fixture.databaseFile + suffix, { force: true });
  });

  it('bulk-saves 100 questions, resolves a lost-response retry, and keeps updates unreviewed', async () => {
    const chunk = await db.documentChunk.findFirstOrThrow({where:{documentId}});
    const questions = Array.from({length:100},(_,i)=>{
      const options=[{id:randomUUID(),text:'Đúng'},{id:randomUUID(),text:'Sai'}];
      return {id:randomUUID(),type:'single' as const,stem:`Câu ${i+1}`,options,correctOptionIds:[options[0].id],acceptedAnswers:[],explanation:'Giải thích theo nguồn gốc.',points:1,difficulty:'recognition' as const,topic:'Test',answerOrigin:'teacher' as const,reviewed:false,sourceRefs:[{chunkId:chunk.id,quote:chunk.content}]};
    });
    const input={requestId:randomUUID(),documentId,title:'100-item fixture',questions};
    const saved=await saveQuiz(teacherId,input); expect(saved.reused).toBe(false);
    expect(await db.question.count({where:{bankId:saved.quiz.bankId}})).toBe(100);
    const retry=await saveQuiz(teacherId,input); expect(retry.quiz.id).toBe(saved.quiz.id); expect(retry.reused).toBe(true);
    await expect(saveQuiz(teacherId,{...input,title:'Different content'})).rejects.toMatchObject({code:'CONFLICT'});
    await expect(saveQuiz(intruderId,{...input,requestId:randomUUID()})).rejects.toMatchObject({code:'NOT_FOUND'});
    await updateOwnedQuizQuestions(teacherId,saved.quiz.id,questions);
    expect(await db.question.count({where:{bankId:saved.quiz.bankId,reviewed:true}})).toBe(0);
    await expect(publishOwnedQuiz(teacherId,saved.quiz.id,{allowReview:true})).rejects.toMatchObject({code:'CONFLICT'});
    const before=await db.questionBank.count();
    await expect(saveQuiz(teacherId,{...input,requestId:randomUUID(),questions:questions.map(q=>({...q,id:randomUUID(),sourceRefs:[{chunkId:chunk.id,quote:'Not in the source'}]}))})).rejects.toMatchObject({code:'INVALID_CITATION'});
    expect(await db.questionBank.count()).toBe(before);
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

  it('recovers the document list when its count query encounters a closed connection once', async () => {
    const count = vi.spyOn(db.document, 'count').mockRejectedValueOnce({ code: 'P1017' });
    try {
      const result = await listUserDocuments(teacherId);
      expect(result.items.some(item => item.id === documentId)).toBe(true);
      expect(result.total).toBe(1);
      expect(count).toHaveBeenCalledTimes(2);
    } finally { count.mockRestore(); }
  });

  it('publishes quiz, lets authenticated student take exam without leaking answers, and grades correctly', async () => {
    const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
    const question = await db.question.findFirstOrThrow({ where: { bankId: quiz.bankId } });
    await db.question.update({ where: { id: question.id }, data: { reviewed: false } });
    await expect(publishOwnedQuiz(teacherId, quizId, { allowReview: true })).rejects.toThrow('duyệt');
    expect(await db.quizVersion.count({ where: { quizId } })).toBe(0);
    await db.question.update({ where: { id: question.id }, data: { reviewed: true } });
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
