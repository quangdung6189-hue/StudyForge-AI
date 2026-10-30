import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { QuestionListSchema, type FullQuestionDTO } from '@studyforge/contracts';
import { assertCitations } from '@studyforge/core';

const inFlight = new Map<string, Promise<FullQuestionDTO[]>>();
const ttlMs = 24 * 60 * 60 * 1000;
const directory = () => path.join(process.env.STUDYFORGE_ROOT ?? process.cwd(), '.data', 'generation-cache');
export const generationCacheKey = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function cachedGeneration(key: string, chunks: { id: string; content: string }[], generate: () => Promise<FullQuestionDTO[]>, enabled = process.env.NODE_ENV !== 'test') {
  if (!enabled) return { questions: await generate(), cached: false };
  const filename = path.join(directory(), `${key}.json`);
  try {
    const record = JSON.parse(await readFile(filename, 'utf8'));
    if (Date.now() - record.createdAt < ttlMs && record.createdAt <= Date.now()) {
      const questions = QuestionListSchema.parse(record.questions); assertCitations(questions, chunks);
      return { questions, cached: true };
    }
  } catch { /* A miss or invalid cache must use the real provider, never a placeholder. */ }
  const pending = inFlight.get(key);
  if (pending) return { questions: await pending, cached: true };
  const promise = (async () => {
    const questions = await generate(); QuestionListSchema.parse(questions); assertCitations(questions, chunks);
    // Cache is an optimization. A filesystem failure must not discard a valid AI response.
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try { await mkdir(directory(), { recursive: true, mode: 0o700 }); await writeFile(temporary, JSON.stringify({ createdAt: Date.now(), questions }), { mode: 0o600 }); await rename(temporary, filename); }
    catch { await unlink(temporary).catch(() => {}); }
    return questions;
  })();
  inFlight.set(key, promise);
  try { return { questions: await promise, cached: false }; } finally { inFlight.delete(key); }
}

/** A cached draft can be saved to more than one quiz without colliding database IDs. */
export function freshQuestionIdentities(questions: FullQuestionDTO[]): FullQuestionDTO[] {
  return questions.map(q => {
    const ids = new Map(q.options.map(option => [option.id, randomUUID()]));
    return { ...q, id: randomUUID(), reviewed: false, options: q.options.map(option => ({ ...option, id: ids.get(option.id)! })), correctOptionIds: q.correctOptionIds.map(id => ids.get(id)!) };
  });
}
