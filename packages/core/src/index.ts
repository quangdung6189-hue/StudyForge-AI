import { createHash, createHmac } from 'node:crypto';
import type { AnswerMap, AttemptGradedResultDTO, FullQuestionDTO, QuizSnapshot, StudentAttemptQuestionDTO } from '@studyforge/contracts';

export function attemptDeadline(startedAt: Date, durationMinutes: number, quizDeadline?: Date | null): Date {
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || (quizDeadline && !Number.isFinite(quizDeadline.getTime()))) throw new Error('Invalid deadline input');
  return new Date(Math.min(startedAt.getTime() + durationMinutes * 60_000, quizDeadline?.getTime() ?? Infinity));
}
export function isExpired(expiresAt: Date, now = new Date()): boolean { return now.getTime() >= expiresAt.getTime(); }

/** Fisher-Yates, seeded with SHA-256, without mutating the input. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  let counter = 0;
  // Rejection sampling avoids modulo bias.
  for (let i = result.length - 1; i > 0; i--) {
    const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    let value: number;
    do { value = createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE(); } while (value >= limit);
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Per-attempt opaque UUIDs hide bank IDs and the private shuffle seed. */
export function transientId(seed: string, id: string): string {
  const bytes = createHmac('sha256', seed).update(id).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** Shuffle that never returns the original order (when the list has 2+ distinct items). */
function shuffleAway<T>(items: readonly T[], seed: string): T[] {
  const shuffled = seededShuffle(items, seed);
  if (items.length > 1 && shuffled.every((item, i) => item === items[i])) shuffled.push(shuffled.shift()!);
  return shuffled;
}

export function studentQuestions(snapshot: QuizSnapshot, seed: string): StudentAttemptQuestionDTO[] {
  return seededShuffle(snapshot.questions, `${seed}:questions`).map(q => {
    const base = { id: transientId(seed, q.id), type: q.type, stem: q.stem, points: q.points, ...(q.audioAssetId ? { audioUrl: `/api/media/${q.audioAssetId}` } : {}) };
    if (q.type === 'matching' && q.pairs?.length) {
      // Left column keeps the teacher's order; right column is shuffled. Pairs are never sent.
      const byId = new Map(q.options.map(o => [o.id, o]));
      const left = q.pairs.map(p => byId.get(p.leftId)!);
      const right = shuffleAway(q.pairs.map(p => byId.get(p.rightId)!), `${seed}:${q.id}:right`);
      return { ...base, options: [...left, ...right].map(o => ({ id: transientId(seed, o.id), text: o.text })), matchLeft: left.map(o => transientId(seed, o.id)) };
    }
    const options = q.type === 'ordering' ? shuffleAway(q.options, `${seed}:${q.id}:options`) : seededShuffle(q.options, `${seed}:${q.id}:options`);
    return { ...base, options: options.map(o => ({ id: transientId(seed, o.id), text: o.text })) };
  });
}
export function decodeAnswers(snapshot: QuizSnapshot, seed: string, answers: AnswerMap): AnswerMap {
  const questions = new Map(snapshot.questions.map(q => [transientId(seed, q.id), q]));
  const decoded: AnswerMap = {};
  for (const [id, values] of Object.entries(answers)) {
    const q = questions.get(id);
    if (!q) throw new Error('Unknown question');
    if (new Set(values).size !== values.length) throw new Error('Duplicate answers');
    if (q.type === 'fill' || q.type === 'short') {
      if (values.length > 1) throw new Error('Only one text answer is permitted');
      decoded[q.id] = values;
    } else if (q.type === 'matching') {
      const options = new Map(q.options.map(o => [transientId(seed, o.id), o.id]));
      const lefts = new Set((q.pairs ?? []).map(p => p.leftId)), rights = new Set((q.pairs ?? []).map(p => p.rightId));
      const seen = new Set<string>();
      decoded[q.id] = values.map(v => {
        const [l, r] = v.split(':'), left = options.get(l ?? ''), right = options.get(r ?? '');
        if (!left || !right || !lefts.has(left) || !rights.has(right) || seen.has(left)) throw new Error('Unknown pair');
        seen.add(left);
        return `${left}:${right}`;
      });
    } else {
      if ((q.type === 'single' || q.type === 'boolean') && values.length > 1) throw new Error('Only one choice is permitted');
      const options = new Map(q.options.map(o => [transientId(seed, o.id), o.id]));
      decoded[q.id] = values.map(v => { const real = options.get(v); if (!real) throw new Error('Unknown option'); return real; });
    }
  }
  return decoded;
}

function normalize(text: string): string { return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi'); }
/** Share of the question earned (0..1). Matching earns per correct pair; everything else is all-or-nothing. */
export function answerCredit(q: FullQuestionDTO, values: string[]): number {
  if (!values.length || new Set(values).size !== values.length) return 0;
  if (q.type === 'fill' || q.type === 'short') return values.length === 1 && q.acceptedAnswers.some(a => normalize(a) === normalize(values[0])) ? 1 : 0;
  if (q.type === 'ordering') return values.length === q.correctOptionIds.length && values.every((id, i) => q.correctOptionIds[i] === id) ? 1 : 0;
  if (q.type === 'matching') {
    const pairs = q.pairs ?? [];
    if (!pairs.length) return 0;
    const expected = new Set(pairs.map(p => `${p.leftId}:${p.rightId}`));
    return values.filter(v => expected.has(v)).length / pairs.length;
  }
  const expected = new Set(q.correctOptionIds);
  return values.length === expected.size && values.every(id => expected.has(id)) ? 1 : 0;
}
export function grade(questions: FullQuestionDTO[], answers: AnswerMap): {
  score: number; totalPoints: number; passed: boolean; details: AttemptGradedResultDTO;
} {
  const byTopic: AttemptGradedResultDTO['byTopic'] = Object.create(null);
  let score = 0;
  let totalPoints = 0;
  const details = questions.map(q => {
    const values = answers[q.id] ?? [];
    const credit = answerCredit(q, values);
    const correct = credit === 1;
    const earnedPoints = Math.round(q.points * credit * 1e6) / 1e6;
    score += earnedPoints; totalPoints += q.points;
    const topic = byTopic[q.topic] ??= { earnedPoints: 0, totalPoints: 0 };
    topic.earnedPoints += earnedPoints; topic.totalPoints += q.points;
    // A non-empty text answer that missed every accepted form may still be right in other words.
    const pendingReview = (q.type === 'short' || q.type === 'fill') && !correct && values.some(v => v.trim().length > 0);
    return {
      questionId: q.id, earnedPoints, points: q.points, correct, correctOptionIds: q.correctOptionIds, acceptedAnswers: q.acceptedAnswers, explanation: q.explanation, sourceRefs: q.sourceRefs,
      type: q.type, difficulty: q.difficulty, ...(q.pairs?.length ? { pairs: q.pairs } : {}), ...(pendingReview ? { pendingReview: true } : {}),
    };
  });
  score = Math.round(score * 1e6) / 1e6;
  totalPoints = Math.round(totalPoints * 1e6) / 1e6;
  return { score, totalPoints, passed: totalPoints > 0 && score / totalPoints >= 0.5, details: { questions: details, byTopic } };
}

/** Re-score a graded result with teacher-confirmed points for individual questions. */
export function applyOverrides(details: AttemptGradedResultDTO, overrides: { questionId: string; points: number; feedback?: string }[]): { score: number; totalPoints: number; passed: boolean; details: AttemptGradedResultDTO } {
  const map = new Map(overrides.map(o => [o.questionId, o]));
  let score = 0, totalPoints = 0;
  const questions = details.questions.map(q => {
    const o = map.get(q.questionId);
    const earnedPoints = o ? Math.max(0, Math.min(q.points, o.points)) : q.earnedPoints;
    score += earnedPoints; totalPoints += q.points;
    return o ? { ...q, earnedPoints, correct: earnedPoints >= q.points, pendingReview: false, ...(o.feedback ? { feedback: o.feedback } : {}) } : q;
  });
  score = Math.round(score * 1e6) / 1e6; totalPoints = Math.round(totalPoints * 1e6) / 1e6;
  return { score, totalPoints, passed: totalPoints > 0 && score / totalPoints >= 0.5, details: { ...details, questions } };
}

// ==================== Spaced repetition (SM-2 family, Anki-style ratings) ====================

export type ReviewState = { easeFactor: number; intervalDays: number; repetitions: number; lapses: number };
/** 0 = Quên (again), 1 = Khó (hard), 2 = Nhớ (good), 3 = Dễ (easy). */
export function scheduleReview(state: ReviewState, rating: 0 | 1 | 2 | 3, now = new Date()): ReviewState & { dueAt: Date } {
  let { easeFactor, intervalDays, repetitions, lapses } = state;
  if (rating === 0) {
    lapses += 1; repetitions = 0; intervalDays = 0; easeFactor = Math.max(1.3, easeFactor - 0.2);
    return { easeFactor, intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + 10 * 60_000) };
  }
  if (rating === 1) {
    intervalDays = repetitions === 0 ? 1 : Math.max(intervalDays + 1, Math.round(intervalDays * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 2) {
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(intervalDays + 1, Math.round(intervalDays * easeFactor));
  } else {
    intervalDays = repetitions === 0 ? 3 : repetitions === 1 ? 6 : Math.max(intervalDays + 2, Math.round(intervalDays * easeFactor * 1.3));
    easeFactor = Math.min(3.2, easeFactor + 0.15);
  }
  intervalDays = Math.min(365, intervalDays);
  repetitions += 1;
  easeFactor = Math.round(easeFactor * 100) / 100;
  return { easeFactor, intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + intervalDays * 86_400_000) };
}
/** Next interval (days; 0 = later today) for each rating, for button labels. */
export function previewIntervals(state: ReviewState): [number, number, number, number] {
  return [0, 1, 2, 3].map(r => scheduleReview(state, r as 0 | 1 | 2 | 3).intervalDays) as [number, number, number, number];
}

// ==================== Printable exam versions ====================

/** Deterministic layout of one paper version: questions and choices shuffled, ordering items shuffled, matching right column shuffled. */
export function versionLayout(questions: FullQuestionDTO[], quizId: string, version: number) {
  const seed = `${quizId}:paper:${version}`;
  return seededShuffle(questions, `${seed}:questions`).map(q => {
    if (q.type === 'matching' && q.pairs?.length) {
      const byId = new Map(q.options.map(o => [o.id, o]));
      const left = q.pairs.map(p => byId.get(p.leftId)!);
      const right = shuffleAway(q.pairs.map(p => byId.get(p.rightId)!), `${seed}:${q.id}:right`);
      return { question: q, left, right, options: [] as typeof q.options };
    }
    const options = q.type === 'boolean' ? q.options : q.type === 'ordering' ? shuffleAway(q.options, `${seed}:${q.id}:options`) : seededShuffle(q.options, `${seed}:${q.id}:options`);
    return { question: q, options, left: [] as typeof q.options, right: [] as typeof q.options };
  });
}

// ==================== Item analysis (class results) ====================

export type ItemStat = {
  questionId: string; responses: number; correctRate: number; discrimination: number | null;
  optionCounts: Record<string, number>; blank: number;
};
/**
 * Classical test theory per question: share correct (difficulty index) and the discrimination
 * index D = p(upper 27%) − p(lower 27%) by total score. D is null with fewer than 4 submissions.
 */
export function itemAnalysis(questions: FullQuestionDTO[], submissions: { score: number; answers: AnswerMap; credits: Record<string, number> }[]): ItemStat[] {
  const ranked = [...submissions].sort((a, b) => b.score - a.score);
  const band = Math.max(1, Math.round(ranked.length * 0.27));
  const upper = ranked.slice(0, band), lower = ranked.slice(-band);
  const rate = (group: typeof ranked, id: string) => group.length ? group.reduce((s, x) => s + ((x.credits[id] ?? 0) >= 1 ? 1 : 0), 0) / group.length : 0;
  return questions.map(q => {
    const optionCounts: Record<string, number> = {};
    let blank = 0, correct = 0;
    for (const s of submissions) {
      const values = s.answers[q.id] ?? [];
      if (!values.length || values.every(v => !v.trim())) blank++;
      if ((s.credits[q.id] ?? 0) >= 1) correct++;
      if (q.type !== 'fill' && q.type !== 'short' && q.type !== 'matching' && q.type !== 'ordering') for (const v of values) optionCounts[v] = (optionCounts[v] ?? 0) + 1;
    }
    return {
      questionId: q.id, responses: submissions.length, blank, optionCounts,
      correctRate: submissions.length ? correct / submissions.length : 0,
      discrimination: submissions.length >= 4 ? Math.round((rate(upper, q.id) - rate(lower, q.id)) * 100) / 100 : null,
    };
  });
}

export function assertCitations(questions: FullQuestionDTO[], chunks: { id: string; content: string }[]): void {
  const sources = new Map(chunks.map(c => [c.id, c.content.normalize('NFC')]));
  for (const q of questions) {
    for (const ref of q.sourceRefs) {
      if (!sources.get(ref.chunkId)?.includes(ref.quote.normalize('NFC'))) throw new Error('Citation does not match document text');
    }
  }
}

export function chunkText(text: string, maxLength = 1800, overlap = 200): { chunkIndex: number; content: string; pageNumber: number | null }[] {
  if (maxLength < 1 || overlap < 0 || overlap >= maxLength) throw new Error('Invalid chunk configuration');
  const result: { chunkIndex: number; content: string; pageNumber: number | null }[] = [];
  const pages = text.normalize('NFC').split('\f');
  pages.forEach((page, pageIndex) => {
    let offset = 0;
    while (offset < page.length) {
      const end = Math.min(offset + maxLength, page.length);
      const content = page.slice(offset, end).trim();
      if (content) result.push({ chunkIndex: result.length, content, pageNumber: pages.length > 1 ? pageIndex + 1 : null });
      if (end === page.length) break;
      offset = end - overlap;
    }
  });
  return result;
}
