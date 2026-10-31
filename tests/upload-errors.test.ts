import { describe, expect, it, vi } from 'vitest';
import { boundedBody, uploadErrorResponse } from '../apps/web/src/server/upload-errors';

describe('Upload diagnostics without leaking server internals', () => {
  it.each([
    ['EROFS', 500, 'STORAGE_NOT_WRITABLE'],
    ['P2021', 503, 'UPLOAD_SCHEMA_MISSING'],
    ['P2022', 503, 'UPLOAD_SCHEMA_MISSING'],
    ['P1017', 503, 'DATABASE_UNAVAILABLE'],
    ['P1000', 503, 'DATABASE_CONFIG_ERROR'],
    ['UNAUTHORIZED', 401, 'UNAUTHORIZED'],
  ])('distinguishes %s from generic failures', async (code, status, expected) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = uploadErrorResponse({ code, message: 'postgresql://private:password@private-host/db SQL statement' });
      expect(response.status).toBe(status);
      const data = await response.json(); expect(data.error.code).toBe(expected);
      expect(JSON.stringify(data)).not.toMatch(/private-host|password|SQL statement/);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-host|password|SQL statement/);
    } finally { log.mockRestore(); }
  });

  it('bounds request streams even without Content-Length', async () => {
    const req = new Request('http://localhost', { method: 'PUT', body: new Uint8Array(10) });
    await expect(boundedBody(req, 5)).rejects.toMatchObject({ status: 413 });
  });
});