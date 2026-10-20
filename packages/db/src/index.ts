import { PrismaClient, Prisma } from '../.generated/postgres';
import { PrismaClient as SQLiteClient } from '../.generated/sqlite';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from 'dotenv';

const root = process.env.STUDYFORGE_ROOT ?? path.resolve(process.cwd());
config({ path: path.join(root, '.env'), quiet: true });
const globalDb = globalThis as unknown as { studyforgeDb?: PrismaClient };
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith('file:')) return new PrismaClient({ datasourceUrl: url });
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
      if (i >= 3 || !['P2034', 'P2028', 'P1008'].includes(code ?? '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 * (i + 1)));
    }
  }
}
