import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ requireUser: vi.fn(), listUserDocuments: vi.fn() }));
vi.mock('@/server/auth', () => ({ requireUser: fixture.requireUser }));
vi.mock('@/server/dal', () => ({ listUserDocuments: fixture.listUserDocuments }));
import { GET } from '../apps/web/src/app/api/documents/route';
beforeEach(() => { fixture.requireUser.mockReset(); fixture.listUserDocuments.mockReset(); fixture.requireUser.mockResolvedValue({ id: 'owner' }); });

describe('Document listing failure handling', () => {
  it('returns a retryable 503 without exposing Prisma internals after recovery is exhausted', async () => {
    fixture.listUserDocuments.mockRejectedValue({ code: 'P1017', message: 'Invalid prisma.document.count(): private database diagnostic' });
    const response = await GET(new Request('http://localhost/api/documents'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('2');
    const data = await response.json();
    expect(data.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(JSON.stringify(data)).not.toMatch(/prisma|count\(|private database/);
  });
  it('keeps guest access blocked', async () => {
    fixture.requireUser.mockRejectedValue({ code: 'UNAUTHORIZED' });
    const response = await GET(new Request('http://localhost/api/documents'));
    expect(response.status).toBe(401);
    expect(fixture.listUserDocuments).not.toHaveBeenCalled();
  });
  it('validates pagination before querying and returns real document results', async () => {
    expect((await GET(new Request('http://localhost/api/documents?limit=-1'))).status).toBe(400);
    expect(fixture.listUserDocuments).not.toHaveBeenCalled();
    const result = { items: [], total: 0, page: 2, limit: 10 };
    fixture.listUserDocuments.mockResolvedValue(result);
    const response = await GET(new Request('http://localhost/api/documents?page=2&limit=10'));
    expect(await response.json()).toEqual(result);
    expect(fixture.listUserDocuments).toHaveBeenCalledWith('owner', 2, 10);
  });
});
