import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const fixture = vi.hoisted(() => ({ requireUser: vi.fn(), getOwnedDocument: vi.fn(), generate: vi.fn() }));
vi.mock('@/server/auth', () => ({ requireUser: fixture.requireUser }));
vi.mock('@/server/dal', () => ({ getOwnedDocument: fixture.getOwnedDocument }));
vi.mock('@/server/generator', () => ({ generateQuizQuestions: fixture.generate }));
import { POST } from '../apps/web/src/app/api/quizzes/generate/route';
import { AIGatewayError } from '@studyforge/ai';
const documentId = randomUUID();
const request = () => new Request('http://localhost/api/quizzes/generate?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId, mode: 'ai_generate', questionCount: 3, types: ['single','boolean','short'] }) });
beforeEach(() => {
  fixture.requireUser.mockReset(); fixture.getOwnedDocument.mockReset(); fixture.generate.mockReset();
  fixture.requireUser.mockResolvedValue({ id: 'owner' }); fixture.getOwnedDocument.mockResolvedValue({ id: documentId, title: 'Test', status: 'ready', revision: 2, rawText: 'Data', chunks: [] });
});
describe('Authenticated generation progress stream', () => {
  it('emits actual completed counts followed by a result and scopes cached work to owner and revision', async () => {
    fixture.generate.mockImplementation(async params => { params.onProgress({ completed: 0, total: 3, cached: 0, stage: 'preparing' }); params.onProgress({ completed: 3, total: 3, cached: 3, stage: 'complete' }); return [{ id: 'fixture' }]; });
    const response = await POST(request()); expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(events.map(event => event.event)).toEqual(['progress','progress','result']);
    expect(events[1].completed).toBe(3); expect(events[1].cached).toBe(3);
    expect(fixture.generate.mock.calls[0][0].cacheScope).toBe(`owner:${documentId}:2`);
  });
  it('reports a timeout as a recoverable error event without a fake question result', async () => {
    fixture.generate.mockRejectedValue(new AIGatewayError('TIMEOUT', 'private upstream diagnostic'));
    const response = await POST(request()); const event = JSON.parse((await response.text()).trim());
    expect(event.event).toBe('error'); expect(event.error.code).toBe('TIMEOUT');
    expect(event.error.message).toContain('được giữ lại'); expect(JSON.stringify(event)).not.toContain('private upstream');
  });
  it('blocks guests before opening a progress stream', async () => {
    fixture.requireUser.mockRejectedValue({ code: 'UNAUTHORIZED' });
    expect((await POST(request())).status).toBe(401); expect(fixture.generate).not.toHaveBeenCalled();
  });
});
