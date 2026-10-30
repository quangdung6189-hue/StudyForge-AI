const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve('.env'), quiet: true });
const { PrismaClient } = require('../packages/db/.generated/postgres');
const { PrismaClient: SQLiteClient } = require('../packages/db/.generated/sqlite');

async function main() {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('PostgreSQL must be configured.');
  const sourcePath = path.resolve(fs.readFileSync('.data/cloud-source-backup.txt', 'utf8').trim());
  const source = new SQLiteClient({ datasourceUrl: `file:${sourcePath.replaceAll('\\', '/')}` });
  const target = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const models = ['user', 'document', 'documentChunk', 'questionBank', 'question', 'questionOption', 'quiz', 'quizVersion', 'attempt', 'attemptAnswer'];
  let verified = 0;
  try {
    for (const name of models) {
      const originals = await source[name].findMany({ select: { id: true } });
      const current = new Set((await target[name].findMany({ where: { id: { in: originals.map(row => row.id) } }, select: { id: true } })).map(row => row.id));
      if (originals.some(row => !current.has(row.id))) throw new Error(`An original ${name} record is missing.`);
      verified += originals.length;
    }
    const originals = await source.user.findMany({ select: { id: true, passwordHash: true } });
    const current = new Map((await target.user.findMany({ where: { id: { in: originals.map(row => row.id) } }, select: { id: true, passwordHash: true } })).map(row => [row.id, row.passwordHash]));
    if (originals.some(row => current.get(row.id) !== row.passwordHash)) throw new Error('An original password hash changed.');
    const report = { originalRecordsVerified: verified, originalPasswordHashesPreserved: originals.length, currentUsers: await target.user.count(), currentDocuments: await target.document.count() };
    fs.writeFileSync('.data/cloud-migration-verified.json', JSON.stringify(report, null, 2));
    console.log('PASS:', JSON.stringify(report));
  } finally { await source.$disconnect(); await target.$disconnect(); }
}

main().catch(error => {
  let message = String(error.message || error);
  const url = process.env.DATABASE_URL;
  if (url) {
    message = message.replaceAll(url, '[redacted connection]');
    const password = new URL(url).password;
    if (password) message = message.replaceAll(password, '[redacted password]').replaceAll(decodeURIComponent(password), '[redacted password]');
  }
  message = message.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, '[redacted connection]');
  console.error('Cloud migration verification failed:', message);
  process.exitCode = 1;
});
