import { afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { cachedGeneration, freshQuestionIdentities, generationCacheKey } from '../apps/web/src/server/generation-cache';
import type { FullQuestionDTO } from '@studyforge/contracts';
const testRoot = path.resolve('.data', `cache-test-${randomUUID()}`);
const oldRoot = process.env.STUDYFORGE_ROOT;
process.env.STUDYFORGE_ROOT = testRoot;
afterAll(async () => { process.env.STUDYFORGE_ROOT = oldRoot; await rm(testRoot, { recursive: true, force: true }); });
const chunk = { id: randomUUID(), content: 'Hai cộng hai bằng bốn.' };
const optionId = randomUUID();
const question: FullQuestionDTO = { id: randomUUID(), type: 'single', stem: 'Hai cộng hai bằng bao nhiêu?', options: [{ id: optionId, text: 'Bốn' }, { id: randomUUID(), text: 'Năm' }], correctOptionIds: [optionId], acceptedAnswers: [], explanation: 'Hai nhóm có hai phần tử được tổng bốn phần tử.', points: 1, difficulty: 'recognition', topic: 'Số học', answerOrigin: 'ai_suggested', reviewed: false, sourceRefs: [{ chunkId: chunk.id, quote: chunk.content }] };
describe('Private generation resume cache', () => {
  it('reuses validated work for an identical scope and produces fresh database identities', async () => {
    const generate = vi.fn().mockResolvedValue([question]);
    const key = generationCacheKey({ scope: 'owner:document:revision', model: 'high', chunks: [chunk] });
    expect((await cachedGeneration(key, [chunk], generate, true)).cached).toBe(false);
    const result = await cachedGeneration(key, [chunk], generate, true);
    expect(result.cached).toBe(true); expect(generate).toHaveBeenCalledTimes(1);
    const fresh = freshQuestionIdentities(result.questions)[0];
    expect(fresh.id).not.toBe(question.id); expect(fresh.correctOptionIds[0]).toBe(fresh.options[0].id); expect(fresh.reviewed).toBe(false);
    expect(generationCacheKey({ scope: 'other-owner', model: 'high', chunks: [chunk] })).not.toBe(key);
    expect(generationCacheKey({ scope: 'owner:document:revision2', model: 'high', chunks: [chunk] })).not.toBe(key);
  });
  it('coalesces concurrent requests and never caches a failed batch', async () => {
    const generate = vi.fn().mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 10)); return [question]; });
    const key = generationCacheKey({ scope: randomUUID() });
    await Promise.all([cachedGeneration(key,[chunk],generate,true),cachedGeneration(key,[chunk],generate,true)]);
    expect(generate).toHaveBeenCalledTimes(1);
    const failedKey = generationCacheKey({ scope: randomUUID() });
    const fail = vi.fn().mockRejectedValue(new Error('upstream failure'));
    await expect(cachedGeneration(failedKey,[chunk],fail,true)).rejects.toThrow();
    await expect(cachedGeneration(failedKey,[chunk],generate,true)).resolves.toMatchObject({ cached: false });
  });
});
