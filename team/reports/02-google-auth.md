# Google authentication and online database verification

Status: implementation, hosted database migration, Google account linking and live Google sign-in completed. Lifecycle: todo -> ready -> running -> review -> done.

Scope: authentication, linking, persistence, database migration and browser checks. This is not a full repository audit or public production deployment.

## Connected resources

- Google Cloud project `studyforge-ai-512309`; Web client **StudyForge Web**; origin `http://localhost:3000`; callback `http://localhost:3000/api/auth/google/callback`.
- OAuth remains **Testing**, with the authorized account added to test users. No paid Google service or billing trial was activated.
- Neon PostgreSQL **Free plan**: project `late-leaf-30930394`, branch `br-winter-rain-b59f5gwx`, database `neondb`, TLS required.
- Credentials are stored only in Git-ignored `.env` and private `.data/` setup backups. No credentials are included here.

## Migration and persistence

- PostgreSQL migrations `0_initial` and `20261021000000_google_auth` applied successfully.
- Source backup, made while the project server was stopped: `.data/backups/pre-cloud-20261021-171923.db`. SQLite and its backup were retained.
- Imported 134 records in one transaction: 7 users, 6 sessions, 4 documents, 13 chunks, 3 banks, 23 questions, 68 options, 3 quizzes, 3 versions, 2 attempts and 2 answers. Other source tables were empty.
- Post-migration verification found all 128 original permanent records across 10 tables and preserved all 7 original password hashes. Expiring/deleted sessions are not treated as immutable records.
- `scripts/import-sqlite-to-postgres.ts` refuses non-empty targets and verifies counts before committing. `scripts/verify-cloud-migration.cjs` checks original IDs and hashes without printing them.
- The legacy seed now refuses to reset an existing account database unless explicitly enabled. Refusal was tested against Neon; subsequent preservation checks passed.

## Real Google sign-in

1. Live Google discovery and RS256 keys were reachable and matched the implementation.
2. Consent requested only `openid email profile`; the server exchanged the real code and validated the signed ID token.
3. The existing email correctly reached `account_exists`. Linking required authentication of the original local account.
4. After that authentication, linking returned to `/dashboard` with the same user ID and no error.
5. Subsequent normal Google sign-in again reached `/dashboard`, preserved the ID and issued a different session token without entering the site's password.
6. Neon confirmed a persisted Google identity and active session; original password hashes were unchanged.

A separate incognito test context was closed during testing. The successful subsequent provider-only sign-in was verified through session-token replacement in the authorized setup profile; a completed separate-incognito login is not claimed.

Private evidence: `.data/real-google-check.json`, `.data/cloud-migration-verified.json`, `.data/browser-auth-checks/report.json`.

## Verification

- **21/21 Chrome checks passed** against the application and Neon: 375px/1280px, login/register, light/dark, reduced motion, keyboard, password visibility, invalid credentials, bcrypt persistence, session reopening, logout/invalidation, subsequent login, distinct sign-in/linking actions and extension/hydration regression.
- With JavaScript disabled, the SSR form remains disabled and uses POST, protecting against native password submission in a GET URL.
- **25/25 unit/integration tests passed**, with isolated SQLite databases. Application data is not reset by either database test suite.
- **22/22 HTTP checks passed** against the application backed by Neon, including teacher/student login and guest restrictions.
- TypeScript checks and production build passed with configured credentials.
- No actual configured server secret/connection string appeared in 45 built client JavaScript assets. Credential files are ignored by Git.

## Resolved findings

| Severity | Location | Reproduction | Remediation |
| --- | --- | --- | --- |
| Medium | `apps/web/src/components/lucian/LucianSignIn.tsx` | An enabled SSR form could accept clicks before hydration; native form fallback could place named password fields in a GET URL. | Disable the fieldset until hydration and during submission; use POST. Verified with JavaScript disabled and interactive browser checks. |
| Low | Sign-in page and Google action | A logged-in demo account changed the main Google action into linking, causing confusing failures with a different Google email. | Keep Google sign-in primary, show the current account, and offer a separate linking action. Verified at 375px while authenticated. |
| High | `packages/db/seed.ts` | The legacy seed deleted all accounts and study data; connecting hosted PostgreSQL made the same command destructive online. | Refuse resets on non-empty account databases unless explicitly enabled. Refusal and preservation checks passed. |

## Operational limits

Google remains in Testing; additional accounts need test-user access until a separate publishing step is completed. The app runs locally at `http://localhost:3000`; production needs its own HTTPS domain/callback. PostgreSQL is online and connected. Public website deployment was outside this task.

Lucian: [#062 Sign-in card feedback](https://lucianlabs.dev/uxui-prompt/#062), adapted for hydration readiness, password-manager fields and clear Google sign-in/linking. Mobile, themes, keyboard and reduced motion were checked.
