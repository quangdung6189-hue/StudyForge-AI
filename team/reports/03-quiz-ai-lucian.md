# Mixed-format quiz generation and Lucian integration review

Scope: creation, extraction, author review, persistence/publication, PDF input, and shared theme navigation. Existing authentication and cloud configuration were retained.

## Resolved findings

- High — `apps/web/src/server/generator.ts`: gateway errors formerly produced fabricated deterministic questions with misleading source provenance. Removed fallback; provider failures are visible. The new structured response validates requested formats, counts, unique identities, answer shape, full-document citations, source preservation, explicit answer keys, and duplicate stems.
- High — `apps/web/src/app/api/quizzes/route.ts`: unvalidated questions and separate bank/quiz writes could persist invalid or partial data. Added contract validation, ownership/citation validation inside a transaction, safe errors, and duplicate-ID conflict handling.
- High — `apps/web/src/server/dal.ts`, `publishOwnedQuiz`: unreviewed questions could be published. The backend now requires explicit review and validates question contracts and current citations before creating a snapshot.
- High — `apps/web/src/server/extractor.ts`: the v2 PDF parser result was treated as a string and malformed PDFs could become binary text. Read actual page text, always release the parser, fail clearly for invalid files, and require OCR for empty scans. No placeholder study text is generated for empty input.
- Medium — `apps/web/src/components/lucian/LucianQuizBuilder.tsx`: hidden format controls, swallowed errors, missing short-answer presentation, and incomplete editing were replaced by a real four-step form with source counts, five formats, review filters, editable answers/explanations, retry states, and explicit review.
- Medium — `apps/web/src/components/lucian/LucianThemeSwitch.tsx`: replaced the emoji-only theme switch with Lucian #219 page reveal; server-rendered preference persistence avoids reload mismatches. Media listener cleanup, reduced motion and browser fallback are provided.
- Low — sidebar parent/child selections highlighted simultaneously and the header title did not follow the quiz route. Fixed active matching and contextual titles; aligned explicit dark-theme contrast with system-dark tokens.

## Evidence

- 45 unit/integration tests passed, with database suites using isolated temporary SQLite databases. Gateway tests cover non-streaming requests, schema visibility through router adapters, default Flash High selection for both purposes, envelope normalization, and safe authentication errors.
- Type checking and production build passed.
- 21 existing browser authentication checks passed, including extension-injected attributes, persisted sessions, Google authorization redirect, and no hydration/runtime errors.
- 20 quiz browser checks passed, including actual Vietnamese PDF extraction, all three source sections, mobile light/dark, keyboard controls, reduced motion, cookie-backed theme reload, invalid generation inputs, real gateway configuration failure, real PostgreSQL draft/publication, review enforcement, citation validation, transaction rollback, and active-exam confidentiality. No runtime or hydration errors occurred.
- The quiz review UI uses a clearly identified provider fixture in the browser test. It is not a product backend or an AI fallback. Real database writes and exam API responses are used.
- No application database reset, migration, or seed was required. Browser cleanup targets only the newly created temporary account and its records.
- Real-provider verification subsequently completed after the owner saved the API key: generation and extraction each returned three validated formats with detailed explanations and citations. The default is `ag/gemini-3.8-flash-high` for generation and review. Restarted the verified workspace Next.js processes; the live authenticated `/api/quizzes/generate` returned HTTP 200 in 28.2 seconds with three valid questions. The new `check:quiz:web` script removes only its own temporary account/document and writes a credential-free result to `.data/quiz-ai-web-check.json`.
- Fixed real 9Router compatibility failures by explicitly disabling streaming and supplying the JSON schema in the prompt as well as `response_format`. Direct-array envelopes are normalized before strict validation, with all question and citation checks retained.

## Outstanding

- Recognition is designed for common Vietnamese numbered exam layouts. Global answer tables, unconventional numbering, and OCR accuracy require manual verification. Exact quote checks cannot prove semantic correctness; review remains mandatory.
- Chrome was checked. Other browser engines were not tested; the theme control provides an immediate-switch fallback when view transitions are unavailable.
