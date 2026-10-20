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
export function studentQuestions(snapshot: QuizSnapshot, seed: string): StudentAttemptQuestionDTO[] {
  return seededShuffle(snapshot.questions, `${seed}:questions`).map(q => ({
    id: transientId(seed, q.id), type: q.type, stem: q.stem, points: q.points,
    options: seededShuffle(q.options, `${seed}:${q.id}:options`).map(o => ({ id: transientId(seed, o.id), text: o.text })),
  }));
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
    } else {
      if ((q.type === 'single' || q.type === 'boolean') && values.length > 1) throw new Error('Only one choice is permitted');
      const options = new Map(q.options.map(o => [transientId(seed, o.id), o.id]));
      decoded[q.id] = values.map(v => { const real = options.get(v); if (!real) throw new Error('Unknown option'); return real; });
    }
  }
  return decoded;
}

function normalize(text: string): string { return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi'); }
function correctAnswer(q: FullQuestionDTO, values: string[]): boolean {
  if (!values.length || new Set(values).size !== values.length) return false;
  if (q.type === 'fill' || q.type === 'short') return values.length === 1 && q.acceptedAnswers.some(a => normalize(a) === normalize(values[0]));
  const expected = new Set(q.correctOptionIds);
  return values.length === expected.size && values.every(id => expected.has(id));
}
export function grade(questions: FullQuestionDTO[], answers: AnswerMap): {
  score: number; totalPoints: number; passed: boolean; details: AttemptGradedResultDTO;
} {
  const byTopic: AttemptGradedResultDTO['byTopic'] = Object.create(null);
  let score = 0;
  let totalPoints = 0;
  const details = questions.map(q => {
    const correct = correctAnswer(q, answers[q.id] ?? []);
    const earnedPoints = correct ? q.points : 0;
    score += earnedPoints; totalPoints += q.points;
    const topic = byTopic[q.topic] ??= { earnedPoints: 0, totalPoints: 0 };
    topic.earnedPoints += earnedPoints; topic.totalPoints += q.points;
    return { questionId: q.id, earnedPoints, points: q.points, correct, correctOptionIds: q.correctOptionIds, acceptedAnswers: q.acceptedAnswers, explanation: q.explanation, sourceRefs: q.sourceRefs };
  });
  score = Math.round(score * 1e6) / 1e6;
  totalPoints = Math.round(totalPoints * 1e6) / 1e6;
  return { score, totalPoints, passed: totalPoints > 0 && score / totalPoints >= 0.5, details: { questions: details, byTopic } };
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
