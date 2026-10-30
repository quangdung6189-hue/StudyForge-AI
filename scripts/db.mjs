import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
config({ path: path.join(root, '.env'), quiet: true });
mkdirSync(path.join(root, '.data'), { recursive: true });
const postgresSchema = 'packages/db/prisma/schema.prisma';
const sqliteSchema = 'packages/db/prisma/schema.sqlite.prisma';
const source = readFileSync(path.join(root, postgresSchema), 'utf8').replace(/generator neonClient\s*\{[^}]*\}\s*/g, '');
writeFileSync(path.join(root, sqliteSchema), '// Generated from schema.prisma by scripts/db.mjs. Do not edit.\n' + source.replace('provider = "postgresql"', 'provider = "sqlite"').replace('../.generated/postgres', '../.generated/sqlite').replace('env("DATABASE_URL")', 'env("SQLITE_DATABASE_URL")'));
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://unused:unused@localhost:5432/unused',
  SQLITE_DATABASE_URL: process.env.DATABASE_URL?.startsWith('file:') ? process.env.DATABASE_URL : process.env.SQLITE_DATABASE_URL ?? `file:${path.join(root, '.data/dev.db').replaceAll('\\', '/')}`,
};
const sqlite = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:');
const selected = sqlite ? sqliteSchema : postgresSchema;

function run(args) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copyEngines() {
  const srcDir = path.join(root, 'packages/db/.generated/postgres');
  const targetDirs = [
    path.join(root, 'node_modules/.prisma/client'),
    path.join(root, 'apps/web/node_modules/.prisma/client'),
    path.join(root, 'apps/web/.generated/postgres'),
  ];
  if (!existsSync(srcDir)) return;
  const files = readdirSync(srcDir);
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
    for (const file of files) {
      if (file.endsWith('.node') || file.endsWith('.wasm') || file.endsWith('.prisma') || file.endsWith('.js') || file.endsWith('.d.ts')) {
        copyFileSync(path.join(srcDir, file), path.join(dir, file));
      }
    }
  }
}

switch (process.argv[2]) {
  case 'generate':
    run(['generate', '--schema', postgresSchema]);
    run(['generate', '--schema', sqliteSchema]);
    copyEngines();
    break;
  case 'validate': run(['validate', '--schema', postgresSchema]); run(['validate', '--schema', sqliteSchema]); break;
  case 'push': run(['db', 'push', '--schema', selected]); break;
  case 'migrate':
    if (sqlite) { console.error('Use npm run db:push for local SQLite. Production migrations require PostgreSQL DATABASE_URL.'); process.exit(1); }
    run(['migrate', 'deploy', '--schema', postgresSchema]); break;
  default: console.error('Usage: node scripts/db.mjs generate|validate|push|migrate'); process.exit(1);
}
