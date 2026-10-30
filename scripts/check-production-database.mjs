import { createHash } from 'node:crypto';
import { db } from '../packages/db/src/index.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing. Configure same connection in deployment environment.');
  process.exitCode = 1;
} else {
  try {
    const parsed = new URL(url);
    const target = createHash('sha256').update(`${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}/${parsed.pathname.replace(/^\//, '')}?schema=${parsed.searchParams.get('schema') || 'public'}`).digest('hex').slice(0, 12);
    const migrations = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    await db.user.findFirst({ select: { id: true, email: true, name: true, role: true, passwordHash: true } });
    await db.session.findFirst({ select: { id: true, userId: true, tokenHash: true, expiresAt: true } });
    const counts = {
      users: await db.user.count(),
      validSessions: await db.session.count({ where: { expiresAt: { gt: new Date() } } }),
      unfinishedExams: await db.attempt.count({ where: { status: 'started', submittedAt: null, expiresAt: { gt: new Date() } } }),
    };
    console.log(JSON.stringify({ target, migrations: migrations.map(row => row.migration_name), authSchema: 'ok', ...counts }));
  } catch (error) {
    console.error('DATABASE_CHECK_FAILED', error?.code ?? error?.name ?? 'UNKNOWN');
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}