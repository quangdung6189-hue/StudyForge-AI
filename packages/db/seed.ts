import bcrypt from 'bcryptjs';
import { db } from './src/index';

async function main() {
  console.log('Seeding StudyForge AI database...');

  // Clean existing data
  await db.attemptAnswer.deleteMany();
  await db.attempt.deleteMany();
  await db.quizVersion.deleteMany();
  await db.quiz.deleteMany();
  await db.questionOption.deleteMany();
  await db.question.deleteMany();
  await db.questionBank.deleteMany();
  await db.documentChunk.deleteMany();
  await db.document.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();

  const teacherPw = await bcrypt.hash('GiaoVien2026!', 10);
  const studentPw = await bcrypt.hash('HocSinh2026!', 10);

  const teacher = await db.user.create({
    data: {
      email: 'giaovien@studyforge.vn',
      name: 'Thầy Nguyễn Văn An (Giáo viên)',
      passwordHash: teacherPw,
      role: 'teacher',
      emailVerifiedAt: new Date(),
    },
  });

  const student = await db.user.create({
    data: {
      email: 'hocsinh@studyforge.vn',
      name: 'Trần Thị Bích (Học sinh)',
      passwordHash: studentPw,
      role: 'student',
      emailVerifiedAt: new Date(),
    },
  });

  // 1. Sinh học 8
  const docBio = await db.document.create({
    data: {
      ownerId: teacher.id,
      title: 'Sinh học 8 — Cấu tạo tế bào và cơ thể người',
      fileType: 'text/plain',
      size: 4096,
      storageKey: `${teacher.id}/bio-8-sample`,
      status: 'ready',
      rawText: `Chương I: Khái quát về cơ thể người.
Tế bào là đơn vị cơ bản cấu tạo nên mọi cơ thể sống, trong đó có cơ thể người.
Mỗi tế bào gồm 3 phần chính: màng sinh chất, chất tế bào (chứa các bào quan như ti thể, lưới nội chất, bộ máy Golgi) và nhân (chứa nhiễm sắc thể và nhân con).
Tập hợp các tế bào chuyên hóa có cấu tạo giống nhau cùng thực hiện một chức năng nhất định tạo thành mô.
Các loại mô chính gồm: mô biểu bì, mô liên kết, mô cơ và mô thần kinh.`,
      chunks: {
        create: [
          {
            chunkIndex: 0,
            content: 'Tế bào là đơn vị cơ bản cấu tạo nên mọi cơ thể sống. Mỗi tế bào gồm 3 phần chính: màng sinh chất, chất tế bào và nhân.',
            pageNumber: 1,
          },
          {
            chunkIndex: 1,
            content: 'Tập hợp các tế bào chuyên hóa có cấu tạo giống nhau cùng thực hiện một chức năng nhất định tạo thành mô. Các loại mô chính: mô biểu bì, mô liên kết, mô cơ, mô thần kinh.',
            pageNumber: 2,
          },
        ],
      },
    },
  });

  const bioBank = await db.questionBank.create({
    data: {
      ownerId: teacher.id,
      documentId: docBio.id,
      title: 'Ngân hàng câu hỏi Sinh học 8 — Tế bào',
      questions: {
        create: [
          {
            position: 0,
            type: 'single',
            stem: 'Cấu tạo chung của một tế bào người gồm những thành phần cơ bản nào?',
            points: 1,
            difficulty: 'recognition',
            topic: 'Sinh học 8',
            answerOrigin: 'document',
            explanation: 'Mỗi tế bào người gồm 3 phần chính: màng sinh chất, chất tế bào và nhân.',
            correctOptionIds: ['bio-opt-1'],
            acceptedAnswers: [],
            sourceRefs: [{ chunkId: 'bio-chunk-0', quote: 'Mỗi tế bào gồm 3 phần chính: màng sinh chất, chất tế bào và nhân' }],
            reviewed: true,
            options: {
              create: [
                { id: 'bio-opt-1', position: 0, text: 'Màng sinh chất, chất tế bào và nhân' },
                { id: 'bio-opt-2', position: 1, text: 'Màng tế bào, vách xenlulôzơ và lục lạp' },
                { id: 'bio-opt-3', position: 2, text: 'Chất tế bào, không bào lớn và nhân' },
                { id: 'bio-opt-4', position: 3, text: 'Màng sinh chất, lông roi và nhân sơ' },
              ],
            },
          },
          {
            position: 1,
            type: 'boolean',
            stem: 'Mô là tập hợp các tế bào chuyên hóa có cấu tạo giống nhau cùng thực hiện một chức năng nhất định.',
            points: 1,
            difficulty: 'recognition',
            topic: 'Sinh học 8',
            answerOrigin: 'document',
            explanation: 'Định nghĩa chính xác theo sách giáo khoa Sinh học 8.',
            correctOptionIds: ['bio-bool-true'],
            acceptedAnswers: [],
            sourceRefs: [{ chunkId: 'bio-chunk-1', quote: 'Tập hợp các tế bào chuyên hóa có cấu tạo giống nhau' }],
            reviewed: true,
            options: {
              create: [
                { id: 'bio-bool-true', position: 0, text: 'Đúng' },
                { id: 'bio-bool-false', position: 1, text: 'Sai' },
              ],
            },
          },
        ],
      },
    },
  });

  const bioQuiz = await db.quiz.create({
    data: {
      ownerId: teacher.id,
      bankId: bioBank.id,
      title: 'Kiểm tra 15 phút Sinh học 8 (Đề mẫu)',
      description: 'Chủ đề: Khái quát cơ thể người và Cấu tạo tế bào',
      durationMinutes: 15,
      isPublished: true,
      shareCode: 'SINHHOC8DEMO',
      publishedVersion: 1,
      versions: {
        create: {
          version: 1,
          snapshot: {
            title: 'Kiểm tra 15 phút Sinh học 8 (Đề mẫu)',
            description: 'Chủ đề: Khái quát cơ thể người và Cấu tạo tế bào',
            durationMinutes: 15,
            deadline: null,
            allowReview: true,
            questions: [
              {
                id: 'bio-q-1',
                type: 'single',
                stem: 'Cấu tạo chung của một tế bào người gồm những thành phần cơ bản nào?',
                options: [
                  { id: 'bio-opt-1', text: 'Màng sinh chất, chất tế bào và nhân' },
                  { id: 'bio-opt-2', text: 'Màng tế bào, vách xenlulôzơ và lục lạp' },
                  { id: 'bio-opt-3', text: 'Chất tế bào, không bào lớn và nhân' },
                  { id: 'bio-opt-4', text: 'Màng sinh chất, lông roi và nhân sơ' },
                ],
                correctOptionIds: ['bio-opt-1'],
                acceptedAnswers: [],
                explanation: 'Mỗi tế bào người gồm 3 phần chính: màng sinh chất, chất tế bào và nhân.',
                points: 5,
                difficulty: 'recognition',
                topic: 'Sinh học 8',
                answerOrigin: 'document',
                sourceRefs: [{ chunkId: 'bio-chunk-0', quote: 'Mỗi tế bào gồm 3 phần chính' }],
                reviewed: true,
              },
              {
                id: 'bio-q-2',
                type: 'boolean',
                stem: 'Mô là tập hợp các tế bào chuyên hóa có cấu tạo giống nhau cùng thực hiện một chức năng nhất định.',
                options: [
                  { id: 'bio-bool-true', text: 'Đúng' },
                  { id: 'bio-bool-false', text: 'Sai' },
                ],
                correctOptionIds: ['bio-bool-true'],
                acceptedAnswers: [],
                explanation: 'Định nghĩa chính xác theo sách giáo khoa Sinh học 8.',
                points: 5,
                difficulty: 'recognition',
                topic: 'Sinh học 8',
                answerOrigin: 'document',
                sourceRefs: [{ chunkId: 'bio-chunk-1', quote: 'Tập hợp các tế bào chuyên hóa' }],
                reviewed: true,
              },
            ],
          },
        },
      },
    },
  });

  // 2. Địa lí 8
  const docGeo = await db.document.create({
    data: {
      ownerId: teacher.id,
      title: 'Địa lí 8 — Vị trí địa lí và phạm vi lãnh thổ Việt Nam',
      fileType: 'text/plain',
      size: 3500,
      storageKey: `${teacher.id}/geo-8-sample`,
      status: 'ready',
      rawText: `Việt Nam nằm ở rìa phía đông của bán đảo Đông Dương, gần trung tâm của khu vực Đông Nam Á.
Vùng đất Việt Nam gồm toàn bộ phần đất liền và các hải đảo với diện tích hơn 331 nghìn km2.
Việt Nam có đường bờ biển dài 3260 km uốn cong hình chữ S từ Móng Cái đến Hà Tiên.
Khí hậu Việt Nam mang tính chất nhiệt đới gió mùa ẩm với hai mùa gió rõ rệt: gió mùa mùa đông và gió mùa mùa hạ.`,
      chunks: {
        create: [
          {
            chunkIndex: 0,
            content: 'Việt Nam nằm ở rìa phía đông của bán đảo Đông Dương. Vùng đất có diện tích hơn 331 nghìn km2 và bờ biển dài 3260 km hình chữ S.',
            pageNumber: 1,
          },
          {
            chunkIndex: 1,
            content: 'Khí hậu Việt Nam mang tính chất nhiệt đới gió mùa ẩm với hai mùa gió chính: gió mùa mùa đông và gió mùa mùa hạ.',
            pageNumber: 2,
          },
        ],
      },
    },
  });

  console.log('Seed completed successfully!');
  console.log('Teacher: giaovien@studyforge.vn / GiaoVien2026!');
  console.log('Student: hocsinh@studyforge.vn / HocSinh2026!');
  console.log('Sample Quiz Code: SINHHOC8DEMO');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
