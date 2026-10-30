import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTransientDatabaseError, readWithRetry, runtimeDatabaseUrl } from '../packages/db/src/resilience';

afterEach(() => { vi.useRealTimers(); });
describe('Database read recovery', () => {
  it('reissues a closed-connection read and returns actual data after bounded backoff', async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockRejectedValueOnce({ code: 'P1017' }).mockRejectedValueOnce({ code: 'P1001' }).mockResolvedValue({ total: 4 });
    const assertion = expect(readWithRetry(read)).resolves.toEqual({ total: 4 });
    await vi.runAllTimersAsync(); await assertion;
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('stops after three attempts and preserves the last connection error', async () => {
    vi.useFakeTimers();
    const error = { code: 'P1017' };
    const read = vi.fn().mockRejectedValue(error);
    const assertion = expect(readWithRetry(read)).rejects.toBe(error);
    await vi.runAllTimersAsync(); await assertion;
    expect(read).toHaveBeenCalledTimes(3);
  });
  it.each(['P2002', 'P2025', 'P1000'])('does not replay non-transient errors (%s)', async code => {
    const error = { code };
    const read = vi.fn().mockRejectedValue(error);
    await expect(readWithRetry(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('recognizes initialization errorCode without matching arbitrary error message text', () => {
    expect(isTransientDatabaseError({ errorCode: 'P1001' })).toBe(true);
    expect(isTransientDatabaseError(new Error('P1017'))).toBe(false);
    expect(isTransientDatabaseError({ name: 'PrismaClientInitializationError', message: "Can't reach database server", errorCode: undefined })).toBe(true);
    expect(isTransientDatabaseError({ name: 'PrismaClientInitializationError', message: 'Authentication failed' })).toBe(false);
    expect(isTransientDatabaseError(null)).toBe(false);
  });
});
describe('Neon runtime connection settings', () => {
  it('adds cold-start and pool limits while preserving credentials and SSL', () => {
    const original = new URL('postgresql://fixture:encoded%40password@ep-fixture-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
    const url = new URL(runtimeDatabaseUrl(original.toString()));
    expect(url.username).toBe(original.username); expect(url.password).toBe(original.password);
    expect(url.host).toBe(original.host); expect(url.pathname).toBe(original.pathname);
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('channel_binding')).toBe('require');
    expect(url.searchParams.get('connect_timeout')).toBe('15');
    expect(url.searchParams.get('pool_timeout')).toBe('15');
    expect(url.searchParams.get('connection_limit')).toBe('5');
  });
  it('respects operator overrides and leaves other databases untouched', () => {
    const explicit = 'postgresql://fixture:pass@ep-fixture.neon.tech/neondb?connect_timeout=30&pool_timeout=40&connection_limit=2';
    expect(runtimeDatabaseUrl(explicit)).toBe(explicit);
    for (const url of ['file:C:/test.db', 'postgresql://fixture:pass@localhost/studyforge', 'postgresql://fixture:pass@neon.tech.attacker.test/studyforge']) expect(runtimeDatabaseUrl(url)).toBe(url);
  });
});
