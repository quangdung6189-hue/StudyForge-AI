# Document-list database connection recovery

Reported symptom: `prisma.document.count()` failed with “Server has closed the connection.” This is consistent with a transient closed PostgreSQL connection (Prisma P1017); Neon suspension or a network interruption can cause connection failures. The exact original disconnection was not reproduced against the owner's active database.

## Changes

- `packages/db/src/resilience.ts`: retry only explicitly wrapped reads for transient P1001/P1002/P1008/P1017/P2024 errors, with at most three attempts and 250/750ms backoff. Recognize both query `code` and initialization `errorCode`. Recreate each read rather than awaiting an already rejected promise.
- `packages/db/src/index.ts`: for Neon runtime clients, default to a 15-second connection timeout, 15-second pool timeout and five connections. Preserve explicit URL parameters, SSL, credentials, hostname and database. No environment credentials, schema or migration were changed.
- `apps/web/src/server/dal.ts`: wrap document list queries (including count) and document detail reads. `apps/web/src/server/auth.ts`: wrap session reads so a recoverable stale connection does not immediately reject an existing session. Authentication still fails closed.
- `apps/web/src/app/api/documents/route.ts`: validate pagination; return a sanitized, non-cacheable HTTP 503 with Retry-After for exhausted transient reads. Never expose raw Prisma/database diagnostics.
- `LucianQuizBuilder.tsx`: show a retry control on library load failure, and avoid claiming that a failed request means the library is empty.

No writes are automatically replayed by this helper. It does not disconnect a pool used by other requests and is not used inside interactive transactions. The existing transaction retry policy was not changed.

## Verification

- 57 tests passed, including an actual DAL list call whose count operation fails once with simulated P1017, exhaustion limits, initialization errors, non-transient error handling, pagination, sanitized 503 responses, and guest access enforcement.
- Type checking passed.
- Live PostgreSQL connection succeeded; six authenticated document-list requests succeeded, including four concurrent requests. Closing and reconnecting only the test process's client also succeeded.
- Browser verification uses a temporary account/document and a simulated HTTP 503 to check the retry UI, then restores the real endpoint. React development StrictMode can abort and repeat initial fetches, so the simulated outage remains active until the retry control is observed.
- Final browser check passed: the temporary outage displayed the retry control, retry loaded the actual owned document, the error cleared, and no browser runtime errors occurred. The assertion excludes Next.js's empty route-announcement alert. Run the same check with `npm run check:database`.
- The shared development server restarted and loaded the new pool settings. An external supervisor restarted port 3000 automatically; the duplicate attempted startup was allowed to exit and the verified existing server was used.
- Test cleanup removes only the temporary account and document. No live database reset, seed or compute suspension was performed. The credential-free live/browser result is `.data/database-recovery-check.json`.

Persistent database/network outages can still return 503 after the retry limit. The fix recovers transient read failures; it cannot make an unavailable upstream database available.

References: [Prisma Neon connection timeouts](https://docs.prisma.io/docs/orm/v6/overview/databases/neon), [Neon compute lifecycle](https://neon.com/docs/manage/endpoints/).
