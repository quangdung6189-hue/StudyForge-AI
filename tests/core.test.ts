import { describe, it, expect } from 'vitest';
import {
  attemptDeadline,
  isExpired,
  seededShuffle,
  transientId,
  studentQuestions,
  decodeAnswers,
  grade,
  assertCitations,
  chunkText,
} from '@studyforge/core';
import type { FullQuestionDTO, QuizSnapshot } from '@studyforge/contracts';

describe('StudyForge Core Logic', () => {
  it('enforces deadline as earlier of duration or quiz deadline', () => {
    const start = new Date('2026-10-21T10:00:00Z');
    const quizDeadline = new Date('2026-10-21T10:20:00Z');

    // 30 min duration but quiz closes in 20 min -> deadline must be 10:20
    const d1 = attemptDeadline(start, 30, quizDeadline);
    expect(d1.toISOString()).toBe('2026-10-21T10:20:00.000Z');

    // 15 min duration with quiz closing in 20 min -> deadline must be 10:15
    const d2 = attemptDeadline(start, 15, quizDeadline);
    expect(d2.toISOString()).toBe('2026-10-21T10:15:00.000Z');
  });

  it('performs deterministic seeded shuffle', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = seededShuffle(list, 'fixed-seed');
    const s2 = seededShuffle(list, 'fixed-seed');
    const s3 = seededShuffle(list, 'different-seed');

    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(s3);
    expect(s1.sort()).toEqual(list);
  });

  it('generates student questions without leaking answers or explanations', () => {
    const sampleQuestion: FullQuestionDTO = {
      id: 'a0000000-0000-0000-0000-000000000001',
      type: 'single',
      stem: 'Thủ đô của Việt Nam là gì?',
      options: [
        { id: 'b0000000-0000-0000-0000-000000000001', text: 'Hà Nội' },
        { id: 'b0000000-0000-0000-0000-000000000002', text: 'TP. Hồ Chí Minh' },
      ],
      correctOptionIds: ['b0000000-0000-0000-0000-000000000001'],
      acceptedAnswers: [],
      explanation: 'Hà Nội là thủ đô của nước CHXHCN Việt Nam.',
      points: 10,
      difficulty: 'recognition',
      topic: 'Địa lí',
      answerOrigin: 'document',
      sourceRefs: [{ chunkId: 'c0000000-0000-0000-0000-000000000001', quote: 'Hà Nội là thủ đô' }],
      reviewed: true,
    };

    const snapshot: QuizSnapshot = {
      title: 'Đề kiểm tra Địa lí',
      description: 'Đề mẫu',
      durationMinutes: 15,
      deadline: null,
      allowReview: true,
      questions: [sampleQuestion],
    };

    const seed = 'exam-seed-123';
    const studentQs = studentQuestions(snapshot, seed);

    expect(studentQs).toHaveLength(1);
    const sq = studentQs[0];
    expect(sq.stem).toBe('Thủ đô của Việt Nam là gì?');
    // Ensure real IDs are masked into transient opaque UUIDs
    expect(sq.id).not.toBe(sampleQuestion.id);
    expect(sq.options[0].id).not.toBe(sampleQuestion.options[0].id);

    // CRITICAL: Ensure NO answer keys or explanations in student object
    expect((sq as any).correctOptionIds).toBeUndefined();
    expect((sq as any).explanation).toBeUndefined();
    expect((sq as any).answerOrigin).toBeUndefined();

    // Decode answers back to real IDs
    const studentSelectedOptionTransientId = sq.options.find(o => o.text === 'Hà Nội')!.id;
    const decoded = decodeAnswers(snapshot, seed, {
      [sq.id]: [studentSelectedOptionTransientId],
    });

    expect(decoded[sampleQuestion.id]).toEqual(['b0000000-0000-0000-0000-000000000001']);

    // Grade
    const result = grade(snapshot.questions, decoded);
    expect(result.score).toBe(10);
    expect(result.passed).toBe(true);
  });

  it('validates citations against document chunks', () => {
    const chunk = { id: 'c0000000-0000-0000-0000-000000000001', content: 'Quang hợp diễn ra tại lục lạp của tế bào thực vật.' };
    const validQuestion: FullQuestionDTO = {
      id: 'a0000000-0000-0000-0000-000000000002',
      type: 'single',
      stem: 'Nơi diễn ra quang hợp?',
      options: [
        { id: 'b0000000-0000-0000-0000-000000000003', text: 'Lục lạp' },
        { id: 'b0000000-0000-0000-0000-000000000004', text: 'Không bào' },
      ],
      correctOptionIds: ['b0000000-0000-0000-0000-000000000003'],
      acceptedAnswers: [],
      explanation: 'Theo tài liệu Sinh học',
      points: 5,
      difficulty: 'recognition',
      topic: 'Sinh học',
      answerOrigin: 'document',
      sourceRefs: [{ chunkId: chunk.id, quote: 'Quang hợp diễn ra tại lục lạp' }],
      reviewed: true,
    };

    expect(() => assertCitations([validQuestion], [chunk])).not.toThrow();

    const invalidQuestion = {
      ...validQuestion,
      sourceRefs: [{ chunkId: chunk.id, quote: 'Cụm từ này hoàn toàn không có trong sách' }],
    };
    expect(() => assertCitations([invalidQuestion], [chunk])).toThrow('Citation does not match document text');
  });

  it('chunks Vietnamese text correctly', () => {
    const sampleText = 'Đoạn một về tự nhiên Việt Nam.\fĐoạn hai về khí hậu nhiệt đới gió mùa.';
    const chunks = chunkText(sampleText, 50, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].content).toContain('Đoạn một');
  });
});
