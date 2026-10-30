const transientCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; errorCode?: unknown; name?: string; message?: string };
  if ([value.code, value.errorCode].some(code => typeof code === 'string' && transientCodes.has(code))) return true;
  return value.name === 'PrismaClientInitializationError' && /Can't reach database server|Server has closed the connection|connection timed out/i.test(value.message ?? '');
}

/** Recreate the read on each attempt. Do not use for writes or inside an interactive transaction. */
export async function readWithRetry<T>(read: () => PromiseLike<T>): Promise<T> {
  const delays = [250, 750];
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= delays.length) throw error;
      // Prisma discards the dead connection; the next query can acquire a healthy one.
      // Do not disconnect the shared pool while other requests are using it.
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}

/** Leave explicit settings and non-Neon databases intact. Never log the returned credential URL. */
export function runtimeDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')) return value;
  const defaults = { connect_timeout: '15', pool_timeout: '15', connection_limit: '5' };
  for (const [key, setting] of Object.entries(defaults)) if (!url.searchParams.has(key)) url.searchParams.set(key, setting);
  return url.toString();
}
