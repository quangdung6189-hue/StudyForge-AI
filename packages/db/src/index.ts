import { PrismaClient, Prisma } from '../.generated/postgres';
import { PrismaClient as NeonClient } from '../.generated/neon';
import { PrismaClient as SQLiteClient } from '../.generated/sqlite';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { config } from 'dotenv';
import { runtimeDatabaseUrl } from './resilience';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
export { isTransientDatabaseError, readWithRetry, runtimeDatabaseUrl } from './resilience';

function getWorkspaceRoot(): string {
  if (process.env.STUDYFORGE_ROOT) return process.env.STUDYFORGE_ROOT;
  let curr = path.resolve(process.cwd());
  while (curr && path.dirname(curr) !== curr) {
    if (existsSync(path.join(curr, '.data', 'dev.db')) || existsSync(path.join(curr, 'StudyForge_AI_Prompts.txt'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(process.cwd());
}

const root = getWorkspaceRoot();
config({ path: path.join(root, '.env'), quiet: true });
const globalDb = globalThis as unknown as { studyforgeDb?: PrismaClient };
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith('file:')) {
    const runtimeUrl = runtimeDatabaseUrl(url), parsed = new URL(runtimeUrl);
    if (parsed.hostname.endsWith('.neon.tech') && process.env.DATABASE_TRANSPORT !== 'tcp') {
      neonConfig.webSocketConstructor = WebSocket;
      return new NeonClient({ adapter: new PrismaNeon({ connectionString: runtimeUrl, max: Number(parsed.searchParams.get('connection_limit')) || 5, connectionTimeoutMillis: (Number(parsed.searchParams.get('connect_timeout')) || 15) * 1000, idleTimeoutMillis: 30000 }, { schema: parsed.searchParams.get('schema') ?? 'public' }) }) as unknown as PrismaClient;
    }
    return new PrismaClient({ datasourceUrl: runtimeUrl });
  }
  if (process.env.NODE_ENV === 'production' && !url) throw new Error('DATABASE_URL must be configured in production');
  mkdirSync(path.join(root, '.data'), { recursive: true });
  const sqliteUrl = url ?? process.env.SQLITE_DATABASE_URL ?? `file:${path.join(root, '.data', 'dev.db').replaceAll('\\', '/')}`;
  return new SQLiteClient({ datasourceUrl: sqliteUrl }) as unknown as PrismaClient;
}
// Lazy creation allows Next build without connecting to a database.
export const db = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const client = globalDb.studyforgeDb ??= createClient();
    const value = Reflect.get(client, key);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
export { Prisma };
export type Transaction = Prisma.TransactionClient;

/** Serializable transactions serialize publication, autosave and submission. */
export async function transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await db.$transaction(work, { isolationLevel: 'Serializable', timeout: 15000, maxWait: 15000 }); }
    catch (error) {
      const code = (error as { code?: string }).code;
      // Replaying an expired interactive transaction only repeats its full timeout.
      if (i >= 3 || !['P2034', 'P1008'].includes(code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 * (i + 1)));
    }
  }
}
