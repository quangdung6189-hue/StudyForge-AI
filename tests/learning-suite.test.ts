import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const fixture = vi.hoisted(() => {
  const databaseFile = `${process.cwd().replaceAll('\\', '/')}/.data/learning-suite-${Date.now()}-${process.pid}.db`;
  process.env.DATABASE_URL = `file:${databaseFile}`;
  process.env.SQLITE_DATABASE_URL = process.env.DATABASE_URL;
  process.env.STUDYFORGE_ROOT = process.cwd();
  return { databaseFile };
});

import JSZip from 'jszip';
import { db } from '@studyforge/db';
import { answerCredit, applyOverrides, grade, itemAnalysis, scheduleReview, studentQuestions, decodeAnswers, versionLayout, transientId } from '@studyforge/core';
import { QuestionSchema, type FullQuestionDTO } from '@studyforge/contracts';
import { saveQuiz } from '../apps/web/src/server/quiz-save';
import { publishOwnedQuiz, startQuizAttempt, saveAttemptAnswers, submitQuizAttempt, updateOwnedQuizSettings, getOwnedQuiz } from '../apps/web/src/server/data-access';
import {
  checkPracticeAnswer, listAttemptHistory, cardsFromAttempt, listStudyCards, reviewStudyCard, studyStats,
  quizAnalytics, quizAnalyticsCsv, gradingQueue, confirmGrade, createClassroom, joinClassroom, assignQuiz, getClassroom, myAssignments,
  listBankQuestions, updateQuestionMeta, createQuizFromBank,
} from '../apps/web/src/server/learning';
import { buildExamDocx, plainMath } from '../apps/web/src/server/exam-docx';

const CHUNK = 'Kim loại dẫn điện tốt nhất là bạc. Thứ tự dẫn điện: Ag > Cu > Au > Al > Fe. Sắt có số oxi hóa +2 và +3.';
function questionsFor(chunkId: string): FullQuestionDTO[] {
  const ref = [{ chunkId, quote: 'Kim loại dẫn điện tốt nhất là bạc.' }];
  const base = { explanation: 'Bạc dẫn điện tốt nhất trong các kim loại.', points: 1, difficulty: 'recognition' as const, topic: 'Kim loại', answerOrigin: 'teacher' as const, sourceRefs: ref, reviewed: true };
  const a = randomUUID(), b = randomUUID(), c = randomUUID(), d = randomUUID();
  const o1 = randomUUID(), o2 = randomUUID(), o3 = randomUUID();
  const l1 = randomUUID(), l2 = randomUUID(), r1 = randomUUID(), r2 = randomUUID();
  return [
    { ...base, id: randomUUID(), type: 'single', stem: 'Kim loại nào dẫn điện tốt nhất?', options: [{ id: a, text: 'Ag' }, { id: b, text: 'Cu' }, { id: c, text: 'Al' }, { id: d, text: 'Fe' }], correctOptionIds: [a], acceptedAnswers: [] },
    { ...base, id: randomUUID(), type: 'short', stem: 'Kí hiệu hóa học của bạc?', options: [], correctOptionIds: [], acceptedAnswers: ['Ag'], rubric: 'Chấp nhận "Ag" hoặc "bạc (Ag)".' },
    { ...base, id: randomUUID(), type: 'ordering', stem: 'Sắp xếp theo độ dẫn điện giảm dần', options: [{ id: o1, text: 'Ag' }, { id: o2, text: 'Cu' }, { id: o3, text: 'Al' }], correctOptionIds: [o1, o2, o3], acceptedAnswers: [] },
    { ...base, id: randomUUID(), type: 'matching', stem: 'Nối kim loại với kí hiệu', options: [{ id: l1, text: 'Bạc' }, { id: l2, text: 'Đồng' }, { id: r1, text: 'Ag' }, { id: r2, text: 'Cu' }], correctOptionIds: [], acceptedAnswers: [], pairs: [{ leftId: l1, rightId: r1 }, { leftId: l2, rightId: r2 }], tags: ['kim loại'] },
  ];
}

describe('Learning suite (isolated SQLite)', () => {
  let teacher: { id: string; email: string; name: string; role: 'teacher' };
  let student: { id: string; email: string; name: string; role: 'student' };
  let other: { id: string; email: string; name: string; role: 'student' };
  let documentId = '', chunkId = '', quizId = '', shareCode = '';

  beforeAll(async () => {
    const pushed = spawnSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'packages/db/prisma/schema.sqlite.prisma', '--skip-generate'], { env: process.env, encoding: 'utf8', timeout: 240000 });
    if (pushed.status !== 0) throw new Error(`db push failed: ${pushed.stderr || pushed.stdout}`);
    const mk = (role: 'teacher' | 'student', name: string) => db.user.create({ data: { email: `${role}-${randomUUID()}@test.local`, name, role } });
    teacher = (await mk('teacher', 'Cô Lan')) as any;
    student = (await mk('student', 'Minh Anh')) as any;
    other = (await mk('student', 'Bảo Ngọc')) as any;
    const doc = await db.document.create({ data: { ownerId: teacher.id, title: 'Kim loại 12', fileType: 'text/plain', size: CHUNK.length, storageKey: `db:${randomUUID()}`, status: 'ready', rawText: CHUNK, chunks: { create: [{ chunkIndex: 0, content: CHUNK, pageNumber: 1 }] } }, include: { chunks: true } });
    documentId = doc.id; chunkId = doc.chunks[0].id;
    const saved = await saveQuiz(teacher.id, { documentId, title: 'Kiểm tra kim loại', description: '', durationMinutes: 15, questions: questionsFor(chunkId) });
    quizId = saved.quiz.id;
    shareCode = (await publishOwnedQuiz(teacher.id, quizId, { allowReview: true })).shareCode;
  }, 300000);

  afterAll(async () => {
    await db.$disconnect();
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${fixture.databaseFile}${suffix}`, { force: true });
  });

  it('validates the new question shapes', () => {
    const qs = questionsFor(randomUUID());
    for (const q of qs) expect(QuestionSchema.safeParse(q).success).toBe(true);
    const badMatching = { ...qs[3], pairs: [qs[3].pairs![0]] };
    expect(QuestionSchema.safeParse(badMatching).success).toBe(false);
    const badOrdering = { ...qs[2], correctOptionIds: qs[2].correctOptionIds.slice(0, 2) };
    expect(QuestionSchema.safeParse(badOrdering).success).toBe(false);
  });

  it('grades ordering exactly and matching per pair, and never leaks pairs to students', () => {
    const [, short, ordering, matching] = questionsFor(randomUUID());
    expect(answerCredit(ordering, ordering.correctOptionIds)).toBe(1);
    expect(answerCredit(ordering, [...ordering.correctOptionIds].reverse())).toBe(0);
    const [p1, p2] = matching.pairs!;
    expect(answerCredit(matching, [`${p1.leftId}:${p1.rightId}`, `${p2.leftId}:${p1.rightId}`])).toBe(0.5);
    const result = grade([short, matching], { [short.id]: ['bạc'], [matching.id]: [`${p1.leftId}:${p1.rightId}`] });
    expect(result.score).toBe(0.5);
    expect(result.details.questions[0].pendingReview).toBe(true);
    const snapshot = { title: 't', description: '', durationMinutes: 10, deadline: null, allowReview: true, questions: [ordering, matching] };
    const student = studentQuestions(snapshot, 'seed-1');
    const m = student.find(q => q.type === 'matching')!;
    expect(m.matchLeft).toHaveLength(2);
    expect(JSON.stringify(student)).not.toContain('pairs');
    expect(JSON.stringify(student)).not.toContain(p1.leftId);
    const o = student.find(q => q.type === 'ordering')!;
    expect(o.options.map(x => x.text)).not.toEqual(['Ag', 'Cu', 'Al']);
    const decoded = decodeAnswers(snapshot, 'seed-1', { [m.id]: [`${m.matchLeft![0]}:${m.options[2].id}`] });
    expect(decoded[matching.id][0]).toMatch(/:/);
  });

  it('schedules reviews with SM-2 style intervals', () => {
    const fresh = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
    const good1 = scheduleReview(fresh, 2);
    expect(good1.intervalDays).toBe(1);
    const good2 = scheduleReview(good1, 2);
    expect(good2.intervalDays).toBe(3);
    const good3 = scheduleReview(good2, 2);
    expect(good3.intervalDays).toBeGreaterThan(3);
    const again = scheduleReview(good3, 0);
    expect(again.repetitions).toBe(0);
    expect(again.lapses).toBe(1);
    expect(again.easeFactor).toBeLessThan(good3.easeFactor);
    expect(scheduleReview(fresh, 3).intervalDays).toBe(3);
  });

  it('computes item statistics and teacher overrides', () => {
    const [single] = questionsFor(randomUUID());
    const right = single.correctOptionIds[0], wrong = single.options[1].id;
    const subs = [5, 4, 3, 1].map((score, i) => ({ score, answers: { [single.id]: [i < 2 ? right : wrong] }, credits: { [single.id]: i < 2 ? 1 : 0 } }));
    const [stat] = itemAnalysis([single], subs);
    expect(stat.correctRate).toBe(0.5);
    expect(stat.discrimination).toBe(1);
    expect(stat.optionCounts[wrong]).toBe(2);
    const graded = grade([single], { [single.id]: [wrong] });
    const re = applyOverrides(graded.details, [{ questionId: single.id, points: 1 }]);
    expect(re.score).toBe(1);
    expect(re.passed).toBe(true);
  });

  it('records every submission, enforces attempt limits and builds review cards from wrong answers', async () => {
    await updateOwnedQuizSettings(teacher.id, quizId, { maxAttempts: 2 });
    const user = { ...student };
    const start = await startQuizAttempt(user, { shareCode });
    const single = start.questions.find(q => q.type === 'single')!;
    const wrong = single.options.find(o => o.text === 'Cu')!;
    await saveAttemptAnswers(student.id, start.attemptId, { [single.id]: [wrong.id] });
    const first = await submitQuizAttempt(student.id, start.attemptId);
    expect(first.recordId).toBeTruthy();
    const retry = await startQuizAttempt(user, { shareCode, retry: true });
    expect(retry.attemptsUsed).toBe(1);
    await submitQuizAttempt(student.id, retry.attemptId);
    await expect(startQuizAttempt(user, { shareCode, retry: true })).rejects.toMatchObject({ code: 'CONFLICT' });

    const history = await listAttemptHistory(student.id);
    expect(history.items).toHaveLength(2);
    expect(history.byType.single.total).toBe(2);

    const deck = await cardsFromAttempt(student.id, start.attemptId);
    expect(deck.created).toBeGreaterThan(0);
    const cards = await listStudyCards(student.id, { deck: deck.deck });
    expect(cards.length).toBe(deck.total);
    const reviewed = await reviewStudyCard(student.id, cards[0].id, 2);
    expect(reviewed.intervalDays).toBe(1);
    const stats = await studyStats(student.id);
    expect(stats.streak).toBe(1);
    expect(stats.reviewedToday).toBe(1);
    await expect(reviewStudyCard(other.id, cards[0].id, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, 120000);

  it('lets only practice quizzes reveal a checked answer, then locks it', async () => {
    const practice = await saveQuiz(teacher.id, { documentId, title: 'Luyện tập', description: '', durationMinutes: 30, questions: questionsFor(chunkId) });
    const code = (await publishOwnedQuiz(teacher.id, practice.quiz.id, { allowReview: true })).shareCode;
    const exam = await startQuizAttempt({ ...other }, { shareCode });
    await expect(checkPracticeAnswer(other.id, exam.attemptId, exam.questions[0].id, [exam.questions[0].options[0]?.id ?? 'x'])).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await updateOwnedQuizSettings(teacher.id, practice.quiz.id, { mode: 'practice' });
    const run = await startQuizAttempt({ ...other }, { shareCode: code });
    expect(run.isPracticeMode).toBe(true);
    const single = run.questions.find(q => q.type === 'single')!;
    const ag = single.options.find(o => o.text === 'Ag')!;
    const feedback = await checkPracticeAnswer(other.id, run.attemptId, single.id, [ag.id]);
    expect(feedback.correct).toBe(true);
    expect(feedback.correctOptionIds).toEqual([ag.id]);
    const cu = single.options.find(o => o.text === 'Cu')!;
    await saveAttemptAnswers(other.id, run.attemptId, { [single.id]: [cu.id] });
    const resumed = await startQuizAttempt({ ...other }, { shareCode: code });
    expect(resumed.answers[single.id]).toEqual([ag.id]);
    expect(resumed.checked?.[single.id]?.correct).toBe(true);
  }, 120000);

  it('supports classes, assignments and teacher analytics with confirmed AI grading', async () => {
    await expect(createClassroom({ ...student }, 'Lớp của tôi')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const klass = await createClassroom({ ...teacher }, '12A1');
    expect(klass.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    await joinClassroom(student.id, klass.joinCode.toLowerCase());
    await assignQuiz(teacher.id, klass.id, { quizId, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
    const teacherView = await getClassroom(teacher.id, klass.id);
    expect(teacherView.role).toBe('owner');
    if (teacherView.role === 'owner') expect(teacherView.assignments[0].submitted).toBe(1);
    const memberView = await getClassroom(student.id, klass.id);
    if (memberView.role === 'member') expect(memberView.assignments[0].status).toBe('done');
    await expect(getClassroom(other.id, klass.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await myAssignments(student.id))).toHaveLength(1);

    const analytics = await quizAnalytics(teacher.id, quizId);
    expect(analytics.summary.students).toBeGreaterThanOrEqual(1);
    expect(analytics.questions).toHaveLength(4);
    await expect(quizAnalytics(student.id, quizId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const csv = await quizAnalyticsCsv(teacher.id, quizId);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Minh Anh');

    // A paraphrased short answer is queued, then a teacher confirms full points.
    const start = await startQuizAttempt({ ...other }, { shareCode });
    const short = start.questions.find(q => q.type === 'short')!;
    await submitQuizAttempt(other.id, start.attemptId, { [short.id]: ['bạc (Ag)'] });
    const queue = await gradingQueue(teacher.id, quizId);
    const item = queue.items.find(i => i.answer === 'bạc (Ag)')!;
    expect(item).toBeTruthy();
    const before = await db.attemptRecord.findUniqueOrThrow({ where: { id: item.recordId } });
    const after = await confirmGrade(teacher.id, item.recordId, item.questionId, item.points, 'Đúng ý.');
    expect(after.score).toBe(before.score + 1);
    await expect(confirmGrade(student.id, item.recordId, item.questionId, 1, '')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, 120000);

  it('reuses bank questions from one document and exports a Word file per version', async () => {
    const bank = await listBankQuestions(teacher.id);
    expect(bank.length).toBeGreaterThanOrEqual(4);
    await updateQuestionMeta(teacher.id, bank[0].id, { tags: ['ôn thi', 'ôn thi', 'HK1'] });
    expect((await listBankQuestions(teacher.id)).find(q => q.id === bank[0].id)!.tags).toEqual(['ôn thi', 'HK1']);
    await expect(updateQuestionMeta(student.id, bank[0].id, { tags: ['x'] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const created = await createQuizFromBank(teacher.id, { questionIds: bank.slice(0, 3).map(q => q.id), title: 'Đề tổng hợp', durationMinutes: 20 });
    const copy = await getOwnedQuiz(teacher.id, created.quiz.id);
    expect(copy.questions).toHaveLength(3);
    expect(copy.questions.map(q => q.id)).not.toContain(bank[0].id);

    const quiz = await getOwnedQuiz(teacher.id, quizId);
    const v1 = versionLayout(quiz.questions, quiz.id, 0).map(i => i.question.id);
    const v1again = versionLayout(quiz.questions, quiz.id, 0).map(i => i.question.id);
    expect(v1).toEqual(v1again);
    const file = await buildExamDocx(quiz, 2, true);
    const zip = await JSZip.loadAsync(file);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('MÃ ĐỀ 101');
    expect(xml).toContain('MÃ ĐỀ 102');
    expect(xml).toContain('ĐÁP ÁN CÁC MÃ ĐỀ');
    expect(plainMath('$\\text{H}_2\\text{SO}_4$')).toBe('H₂SO₄');
    expect(transientId('s', 'x')).toMatch(/^[0-9a-f-]{36}$/);
  }, 120000);
});
