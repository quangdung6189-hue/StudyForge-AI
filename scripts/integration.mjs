import assert from 'node:assert/strict';
import { attemptDeadline, isExpired, seededShuffle, studentQuestions, decodeAnswers, grade, chunkText } from '../packages/core/src/index.ts';

console.log('--- Running StudyForge AI Integration Checks ---');

// 1. Core Deadlines
const now = new Date('2026-10-21T00:00:00Z');
const deadline1 = attemptDeadline(now, 15, new Date('2026-10-21T01:00:00Z'));
assert.equal(deadline1.toISOString(), '2026-10-21T00:15:00.000Z');

const deadline2 = attemptDeadline(now, 60, new Date('2026-10-21T00:30:00Z'));
assert.equal(deadline2.toISOString(), '2026-10-21T00:30:00.000Z');
console.log('✓ Deadline enforcement passed');

// 2. Core Seeded Shuffle
const list = [1, 2, 3, 4, 5, 6, 7, 8];
const s1 = seededShuffle(list, 'fixed-seed-test');
const s2 = seededShuffle(list, 'fixed-seed-test');
assert.deepEqual(s1, s2);
assert.notDeepEqual(s1, list);
console.log('✓ Seeded deterministic shuffle passed');

// 3. Question Projection & Zero Leaks
const fullQ = {
  id: 'q-100',
  type: 'single',
  stem: 'Thành phần nào mang vật chất di truyền của tế bào?',
  options: [
    { id: 'opt-a', text: 'Màng sinh chất' },
    { id: 'opt-b', text: 'Nhân tế bào' },
    { id: 'opt-c', text: 'Chất tế bào' },
  ],
  correctOptionIds: ['opt-b'],
  acceptedAnswers: [],
  explanation: 'Nhân chứa NST mang ADN di truyền.',
  points: 10,
  difficulty: 'recognition',
  topic: 'Sinh học',
  answerOrigin: 'document',
  sourceRefs: [{ chunkId: 'c1', quote: 'Nhân mang vật chất di truyền' }],
  reviewed: true,
};

const snapshot = {
  title: 'Đề Sinh Học 8',
  description: 'Kiểm tra 15 phút',
  durationMinutes: 15,
  deadline: null,
  allowReview: true,
  questions: [fullQ],
};

const studentQs = studentQuestions(snapshot, 'attempt-seed-xyz');
assert.equal(studentQs.length, 1);
const sq = studentQs[0];
assert.equal(sq.stem, fullQ.stem);
assert.equal(sq.points, 10);
// Ensure NO correct answers or explanation leaked!
assert.equal(sq.correctOptionIds, undefined);
assert.equal(sq.explanation, undefined);
assert.equal(sq.sourceRefs, undefined);
assert.notEqual(sq.id, 'q-100'); // Transient ID masked
console.log('✓ Question projection: Zero answers/explanations leaked');

// 4. Answer Decoding & Grading
const rightOptionTransientId = sq.options.find(o => o.text === 'Nhân tế bào').id;
const studentAnswerMap = {
  [sq.id]: [rightOptionTransientId],
};

const decoded = decodeAnswers(snapshot, 'attempt-seed-xyz', studentAnswerMap);
assert.deepEqual(decoded['q-100'], ['opt-b']);

const graded = grade(snapshot.questions, decoded);
assert.equal(graded.score, 10);
assert.equal(graded.totalPoints, 10);
assert.equal(graded.passed, true);
console.log('✓ Answer decoding and grading engine passed');

// 5. Text Chunking
const sampleText = 'Đoạn văn thứ nhất nói về cấu tạo tế bào.\fTrang thứ hai nói về chuyển hóa vật chất và năng lượng.';
const chunks = chunkText(sampleText, 50, 10);
assert.ok(chunks.length >= 2);
console.log('✓ Vietnamese document chunking passed');

console.log('All 5 integration scenarios completed successfully with 100% assertions green.');
