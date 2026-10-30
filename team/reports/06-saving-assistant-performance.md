# Reliable saving, smoother review and embedded assistant

Owner: Codex. Completed on 2026-10-22. No live database reset, schema migration, seed, unrelated file deletion or deployment was performed. Existing uncommitted work was preserved.

## Reproduced failure and resolution

The original nested Prisma create performed individual question/option writes. A controlled 29-question, four-option fixture failed against the actual Neon database with P2028: the 15-second interactive transaction expired (19.2 seconds total including fixture setup). This reproduces the user's generic save error; it is unrelated to the AI key.

`apps/web/src/server/quiz-save.ts:30` now inserts question and option rows with `createMany` inside the same ownership/citation-checked transaction. Updates use the same bulk strategy. Validation still runs before writes, and duplicate IDs or invalid citations cannot leave partial question banks. Transient failures return safe retry messages; expired transactions are no longer automatically repeated four times.

The builder supports explicit draft saving and reopening by quiz ID. Review state survives reloads. The client retains an operation UUID and the server recognizes an identical committed save if its response was lost. Different content with the same UUID returns conflict. Publication is also idempotent for identical settings. Unchanged saved content is not PATCHed before retrying publication, so a committed-but-lost publish response can be recovered.

## Review findings

| Severity | Location | Reproduction / implication | Resolution |
| --- | --- | --- | --- |
| High | `apps/web/src/server/quiz-save.ts:30` | Nested create of 29 questions times out; user cannot persist a larger exam | Bulk atomic question/option writes; final actual 100-question save passed |
| High | `apps/web/src/server/quiz-save.ts:12` | Lost save response can leave an existing draft while UI retries | Owner-scoped operation ID, exact payload comparison, concurrent duplicate recovery |
| High | `apps/web/src/components/lucian/LucianQuizBuilder.tsx:186` | A lost publication response followed by an unnecessary PATCH hits the published-item edit guard | Skip unchanged writes; identical publication returns the existing version; browser injects a lost response and verifies recovery |
| High | `apps/web/src/server/dal.ts:229` | Old update logic forced all edited questions to reviewed | Bulk updates preserve the submitted review flags, with schema/citation validation; unreviewed publication stays blocked |
| Medium | `apps/web/src/components/lucian/LucianQuizBuilder.tsx:246` | Every review card and editor was mounted for a large bank | Ten cards per review page, persistent review state across pages/reloads |
| Medium | `apps/web/src/app/(workspace)/documents/page.tsx:61` | Large question lists and immediate search could perform excess layout work | Twenty rows per document page and deferred search filtering |
| Medium | `apps/web/src/server/auth.ts:70` | Layout/page repeat session reads during one server render | React request-scoped memoization; no cross-request authorization cache |
| Medium | `apps/web/src/instrumentation-client.ts:23` | Extension attributes can reappear on client navigation | Narrow attribute cleanup for inserted nodes; no hydration-error suppression |
| High, prevented | `apps/web/src/app/api/assistant/route.ts:13` | Manually calling chat while taking an exam could bypass a hidden UI | Backend checks active unexpired attempts before context/model access, plus UI hiding |

Document-list errors now remain visible in the bank instead of masquerading as an empty library. Workspace navigation has a loading boundary. Save/publish errors do not expose raw Prisma diagnostics.

## Added capabilities

- **Dùng đáp án gốc · Không gọi AI**: deterministic creation from source-verified answer keys, preserving original text/options and review requirements. Unknown keys are excluded; missing worked solutions are explicitly identified.
- Protected source exports: `studyforge.document.v1` JSON, CSV question rows and Markdown text. CSV formula prefixes are escaped. Unsupported items/warnings remain in JSON; no keys are invented.
- Floating Lucian #215 assistant: actual 9Router Flash High SSE responses, batched client rendering, stop/copy/new-conversation controls, optional owned-document context and real Vietnamese Wikipedia lookup with source links. No simulated replies. Context and history sizes are bounded; 30 requests/account/15 minutes are enforced in persisted buckets. History is not retained across reloads. Code is displayed, not executed.
- Optional private Docling connector for complex file layout, using the current typed-source/in-body API. GitHub research also reviewed MarkItDown, MinerU and existing Mammoth. See [document tools](../../docs/DOCUMENT_TOOLS.md).

## Verification

- **82 automated tests**, 13 test files, passed. New cases include 100-item bulk writes, idempotency/content conflicts, owner/citation guards, unreviewed updates, original-answer creation, fragmented UTF-8/SSE, truncated streams, chat authentication/exam/rate limits and the current Docling request contract.
- **68 browser checks** passed: auth 21, quiz 19, document studio 14, workspace upgrade 14. The quiz suite labels its review fixtures; the document/workspace suites call the real configured High model.
- Type checking and the production build passed after implementation.
- Final workspace run: save 100 questions **4,772 ms**; update 100 **3,983 ms**; four-item source-only creation **1,195 ms**; actual two-sentence assistant UI response **7,702 ms**; live Wikipedia lookup returned **three linked sources**. Other runs under simultaneous compile/test load took about 5.5–8.2 seconds to save. These are measured local examples, not SLAs or first-token latency measurements.
- Browser tests confirm draft review survives reload, only ten review cards mount, a deliberately lost publish response can be retried, and only one published version remains.
- The final document regression generated four mixed-format items with real AI in 18 seconds and verified cache reuse, TXT/DOCX parsing, revision conflicts, original-file ownership and themes/mobile/keyboard behavior.
- Fresh-browser runs report no JavaScript runtime or hydration errors. Extension cleanup was also tested during auth hydration. Existing user-browser logs contain separate `chrome-extension://...` M_ID exceptions that application code cannot repair inside that extension.

Private artifacts: `.data/workspace-upgrade-checks/results.json`, desktop/mobile chat screenshots, `.data/browser-auth-checks`, `.data/browser-quiz-checks`, `.data/document-studio-checks`. Tests remove only their temporary users/documents/banks/quizzes/versions/attempts/files; the workspace suite also cleans its rate-limit buckets.

## Limits and unverified scope

- Docling is **not installed or live-benchmarked** on this machine. Python is present; Docker is not. The connector is contract-tested and shown in the UI only when a private service is configured. Its text integration does not reconstruct page-level positions from JSON yet. No private uploads are sent to public demo services.
- Lookup is Wikipedia, not unrestricted web browsing/news verification. Missing/failed lookup is explicitly disclosed. AI answers can be wrong and still require verification.
- Layout and interaction checks cover Chrome desktop/375px, light/dark, reduced motion and keyboard. Other engines, real mobile keyboards, handwriting/all scan layouts, prolonged load and every browser extension were not exhaustively tested. No claim that every possible source of device/browser lag is eliminated.
- Navigation checks visit `/study`; its existing generic methodology flashcards were not replaced with a new persistent spaced-repetition system in this task.

Lucian source: [#215 Support chat from a launcher bubble](https://lucianlabs.dev/uxui-prompt/#215). Original spring/icon/message/typing motion is retained. Adaptations are the real workspace footprint, responsive text area, model/source controls and accessible global Escape cleanup. Existing #015 cards gained the third creation mode; their visual tokens/motion remain unchanged.
