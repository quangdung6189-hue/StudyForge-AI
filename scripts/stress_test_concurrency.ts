import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../packages/db/src/index';
import { startQuizAttempt, saveAttemptAnswers, submitQuizAttempt } from '../apps/web/src/server/dal';

async function run() {
  console.log('=== BẮT ĐẦU KIỂM TRA CHỊU TẢI 100 NGƯỜI LÀM BÀI ĐỒNG THỜI ===');
  const USERS = 100;
  const suffix = randomBytes(4).toString('hex');

  const teacher = await db.user.create({
    data: { email: `t-${suffix}@test.com`, name: 'Teacher', role: 'teacher' },
  });

  const doc = await db.document.create({
    data: {
      ownerId: teacher.id, title: 'Đề test tải', fileType: 'text/plain', size: 100,
      storageKey: `stress/${randomUUID()}`, status: 'ready',
      chunks: { create: { chunkIndex: 0, content: 'Bài kiểm tra tải StudyForge' } },
    },
    include: { chunks: true },
  });

  const questions = Array.from({ length: 10 }, (_, i) => {
    const qId = randomUUID();
    const optA = randomUUID();
    const optB = randomUUID();
    return {
      id: qId, type: 'single', stem: `Câu hỏi ${i + 1}: Đúng hay sai?`,
      options: [{ id: optA, text: 'Đúng' }, { id: optB, text: 'Sai' }],
      correctOptionIds: [optA], acceptedAnswers: [], explanation: 'Giải thích',
      points: 1, difficulty: 'recognition', topic: 'LoadTest',
      answerOrigin: 'teacher', sourceRefs: [{ chunkId: doc.chunks[0].id, quote: 'StudyForge' }],
      reviewed: true,
    };
  });

  const bank = await db.questionBank.create({
    data: { ownerId: teacher.id, documentId: doc.id, title: 'Bank test' },
  });

  await db.question.createMany({
    data: questions.map(({ options, ...q }, position) => ({ ...q, bankId: bank.id, position })),
  });
  await db.questionOption.createMany({
    data: questions.flatMap(q => q.options.map((opt, position) => ({ ...opt, questionId: q.id, position }))),
  });

  const shareCode = `LOAD${suffix.toUpperCase()}`;
  const quiz = await db.quiz.create({
    data: { ownerId: teacher.id, bankId: bank.id, title: 'Đề thi 100 thí sinh', durationMinutes: 30, isPublished: true, shareCode, publishedVersion: 1, allowReview: true },
  });

  await db.quizVersion.create({
    data: { quizId: quiz.id, version: 1, snapshot: { title: quiz.title, durationMinutes: 30, deadline: null, allowReview: true, questions } as any },
  });

  console.log(`[1] Tạo ${USERS} thí sinh...`);
  const students = await db.$transaction(
    Array.from({ length: USERS }, (_, i) => db.user.create({ data: { email: `s-${suffix}-${i}@test.com`, name: `Student ${i}`, role: 'student' } }))
  );

  console.log(`[2] Chạy song song ${USERS} thí sinh: Vào thi -> Lưu đáp án -> Nộp bài...`);
  const start = Date.now();
  let startOk = 0, saveOk = 0, submitOk = 0;
  const errors: string[] = [];

  await Promise.all(students.map(async (st, i) => {
    try {
      const u = { id: st.id, email: st.email, name: st.name, role: 'student' as const };
      const attempt = await startQuizAttempt(u, { shareCode });
      startOk++;

      for (let s = 0; s < 3; s++) {
        const q = attempt.questions[s % attempt.questions.length];
        await saveAttemptAnswers(st.id, attempt.attemptId, { [q.id]: [q.options[0].id] });
        saveOk++;
      }

      const res = await submitQuizAttempt(st.id, attempt.attemptId, { [attempt.questions[0].id]: [attempt.questions[0].options[0].id] });
      if (res.passed !== undefined) submitOk++;
    } catch (e: any) {
      errors.push(`Student ${i}: ${e.message}`);
    }
  }));

  const sec = (Date.now() - start) / 1000;
  console.log('\n=== KẾT QUẢ ĐO TẢI ===');
  console.log(`- Thời gian hoàn tất: ${sec.toFixed(2)}s`);
  console.log(`- Vào phòng thi: ${startOk}/${USERS}`);
  console.log(`- Lưu bài (Autosaves): ${saveOk}/${USERS * 3}`);
  console.log(`- Nộp bài thành công: ${submitOk}/${USERS}`);
  console.log(`- Số lỗi: ${errors.length}`);
  if (errors.length) console.log('Lỗi:', errors.slice(0, 3));

  console.log('\n[3] Dọn dẹp...');
  const ids = students.map(s => s.id);
  await db.attemptAnswer.deleteMany({ where: { attempt: { userId: { in: ids } } } });
  await db.attempt.deleteMany({ where: { userId: { in: ids } } });
  await db.quizVersion.deleteMany({ where: { quizId: quiz.id } });
  await db.quiz.deleteMany({ where: { id: quiz.id } });
  await db.questionOption.deleteMany({ where: { question: { bankId: bank.id } } });
  await db.question.deleteMany({ where: { bankId: bank.id } });
  await db.questionBank.deleteMany({ where: { id: bank.id } });
  await db.documentChunk.deleteMany({ where: { documentId: doc.id } });
  await db.document.deleteMany({ where: { id: doc.id } });
  await db.user.deleteMany({ where: { id: { in: [...ids, teacher.id] } } });
  console.log('✓ Hoàn tất.');
}

run().catch(console.error).finally(() => db.$disconnect());
