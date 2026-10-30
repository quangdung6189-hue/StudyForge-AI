import { config } from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { PrismaClient, Prisma } from '../packages/db/.generated/postgres';
import { PrismaClient as SQLiteClient } from '../packages/db/.generated/sqlite';

config({ path: path.resolve('.env'), quiet: true });

// Parent records precede their dependants. All writes occur in one transaction.
const models = [
  'user', 'session', 'verificationToken', 'googleAuthAttempt', 'document', 'documentChunk',
  'questionBank', 'question', 'questionOption', 'quiz', 'quizVersion', 'attempt', 'attemptAnswer', 'rateLimitBucket',
] as const;
const jsonFields: Partial<Record<typeof models[number], string[]>> = {
  question: ['correctOptionIds', 'acceptedAnswers', 'sourceRefs'], quizVersion: ['snapshot'],
  attempt: ['result'], attemptAnswer: ['values'],
};
type Row = Record<string, unknown>;
type Delegate = {
  count(): Promise<number>;
  findMany(): Promise<Row[]>;
  createMany(args: { data: Row[] }): Promise<{ count: number }>;
};

async function main() {
  const sourceArgument = process.argv.indexOf('--source');
  if (sourceArgument < 0 || !process.argv[sourceArgument + 1]) throw new Error('Specify a SQLite backup with --source PATH. Stop the app before making the backup.');
  const sourcePath = path.resolve(process.argv[sourceArgument + 1]);
  if (!existsSync(sourcePath)) throw new Error('Source backup does not exist.');
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl || !/^postgres(?:ql)?:\/\//.test(targetUrl)) throw new Error('A PostgreSQL DATABASE_URL is required.');
  const source = new SQLiteClient({ datasourceUrl: `file:${sourcePath.replaceAll('\\', '/')}` });
  const target = new PrismaClient({ datasourceUrl: targetUrl });
  try {
    const snapshot = new Map<typeof models[number], Row[]>();
    for (const name of models) {
      const model = Reflect.get(source, name) as Delegate;
      const rows = await model.findMany();
      for (const row of rows) {
        for (const field of jsonFields[name] ?? []) {
          if (row[field] === null) row[field] = name === 'attempt' && field === 'result' ? Prisma.DbNull : Prisma.JsonNull;
        }
      }
      snapshot.set(name, rows);
    }
    await target.$transaction(async tx => {
      for (const name of models) {
        if (await (Reflect.get(tx, name) as Delegate).count() !== 0) {
          throw new Error(`Target ${name} is not empty. Import stopped without overwriting records.`);
        }
      }
      for (const name of models) {
        const rows = snapshot.get(name)!;
        const model = Reflect.get(tx, name) as Delegate;
        for (let offset = 0; offset < rows.length; offset += 250) {
          await model.createMany({ data: rows.slice(offset, offset + 250) });
        }
        if (await model.count() !== rows.length) throw new Error(`Record verification failed for ${name}.`);
        console.log(`Verified ${name}: ${rows.length} records.`);
      }
    }, { timeout: 120000, maxWait: 15000 });
    console.log('Import committed. IDs, password hashes and session hashes preserved; the source backup was not modified.');
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch(error => {
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, '[redacted database connection]'));
  process.exitCode = 1;
});
