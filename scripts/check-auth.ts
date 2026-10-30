import { db } from '../packages/db/src/index';
import { getGoogleConfig } from '../apps/web/src/server/google-oauth';

async function main() {
  const url = process.env.DATABASE_URL;
  const database = url && !url.startsWith('file:') ? 'PostgreSQL' : 'SQLite (local)';
  try {
    await db.$queryRaw`SELECT 1`;
    // Explicit projections verify the auth migration without retrieving secrets.
    await db.user.findFirst({ select: { id: true, googleSubject: true, lastLoginAt: true } });
    await db.session.findFirst({ select: { id: true } });
    await db.googleAuthAttempt.findFirst({ select: { id: true } });
    console.log(`Database: ${database}; connection and auth schema OK.`);
  } catch {
    console.error(`Database: ${database}; connection or auth schema check failed. Check the server environment and migrations.`);
    process.exitCode = 1;
  }
  try {
    const config = getGoogleConfig();
    console.log(`Google OAuth: configured. Register this exact redirect URI: ${config.redirectUri}`);
    console.log('This configuration check does not perform an interactive Google sign-in.');
  } catch {
    console.error('Google OAuth: incomplete configuration. Set APP_URL, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.');
    process.exitCode = 1;
  }
  if (process.argv.includes('--stored-google')) {
    const identities = await db.user.count({ where: { googleSubject: { not: null } } });
    const sessions = await db.session.count({ where: { user: { googleSubject: { not: null } }, expiresAt: { gt: new Date() } } });
    console.log(`Persisted Google identities: ${identities}; active Google-account sessions: ${sessions}.`);
  }
  if (process.argv.includes('--live-google')) {
    try {
      const response = await fetch('https://accounts.google.com/.well-known/openid-configuration', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Discovery unavailable');
      const discovery = await response.json();
      if (discovery.issuer !== 'https://accounts.google.com' || discovery.token_endpoint !== 'https://oauth2.googleapis.com/token' || discovery.jwks_uri !== 'https://www.googleapis.com/oauth2/v3/certs') {
        throw new Error('Unexpected provider metadata');
      }
      const keys = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(10000) });
      if (!keys.ok || !(await keys.json()).keys?.some((key: { kty?: string; alg?: string }) => key.kty === 'RSA' && key.alg === 'RS256')) {
        throw new Error('Signing keys unavailable');
      }
      console.log('Live Google discovery and RS256 signing keys: reachable; endpoints match this implementation.');
    } catch {
      console.error('Live Google provider check failed. Check outbound HTTPS access.');
      process.exitCode = 1;
    }
  }
}

main().catch(() => { console.error('Auth configuration check failed.'); process.exitCode = 1; }).finally(() => db.$disconnect());
