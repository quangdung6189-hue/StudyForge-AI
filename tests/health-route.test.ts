import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ query: vi.fn(), user: vi.fn(), session: vi.fn(), file: vi.fn(), upload: vi.fn(), part: vi.fn() }));
vi.mock('@studyforge/db', () => ({ db: { $queryRaw: fixture.query, user: { findFirst: fixture.user }, session: { findFirst: fixture.session }, documentFile: { findFirst: fixture.file }, documentUpload: { findFirst: fixture.upload }, documentUploadPart: { findFirst: fixture.part } }, readWithRetry: (read: () => unknown) => read() }));
import { GET } from '../apps/web/src/app/api/health/route';
beforeEach(() => { Object.values(fixture).forEach(mock => mock.mockReset().mockResolvedValue(null)); });

describe('Health distinguishes DB connectivity from missing upload migrations', () => {
  it('checks upload tables without selecting original bytes or credentials', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ database: 'connected', uploadSchema: 'available', documentStorage: 'database' });
    expect(fixture.file).toHaveBeenCalledWith({ select: { documentId: true } });
  });
  it('reports a missing upload migration without exposing SQL or environment paths', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fixture.file.mockRejectedValue({ code: 'P2021', message: 'postgresql://private:password@host/db SELECT secret', name: 'PrismaError' });
      const response = await GET(); const data = await response.json();
      expect(response.status).toBe(503); expect(data.code).toBe('UPLOAD_SCHEMA_MISSING');
      expect(JSON.stringify(data)).not.toMatch(/password|SELECT|envEngine|private/);
    } finally { log.mockRestore(); }
  });
});