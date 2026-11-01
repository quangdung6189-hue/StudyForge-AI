# Exam-Parser-Pro implementation report

## Delivered

- Added project skill `skills/exam-parser-pro/SKILL.md`, linked from `AGENTS.md` and existing reader protocol. It expands the supplied prompt with provenance, unknown/null handling, conservative OCR repairs, bounded processing and regression requirements.
- Shared `exam-layout.ts` now repairs clearly glued boundaries and performs terminal-option-first classification before section/body heuristics. Matching tables and a/b context stay in MCQ stems when complete terminal A–D choices exist.
- Explicit-label sorting supports A,C,B,D without moving answer meaning by array position. Missing option labels are suggestions requiring review; original numbers and numerical payloads are not silently rewritten.
- Recognizes single true/false, explicit verdict tables, empty cells, `SAI X`, unnumbered short questions and retained essays. Source statements/partial known verdicts remain reviewable; absent values are null, not false.
- Fixed Word HTML conversion and extraction so empty verdict cells, including trailing cells in the final row, preserve column position. Answer citations for transformed tables use original row text rather than manufactured verdict text.
- Added validated four-category JSON attachment at `GET /api/documents/:id/export?format=exam-pro` and reader link. Preserves existing JSON/CSV/Markdown contracts. Missing metadata/answers stay null; deterministic export never invokes AI or claims universal accuracy.
- Routed `ai_analyze` through the existing typed, batched extraction gateway. Removed unused provider `.generate` branch with implicit boolean-default/fallback source behavior. Actual stems/options and verified source keys are retained, source refs validated, new model answers labeled `ai_suggested`, review remains mandatory.
- Added user guide `docs/EXAM_PARSER_PRO.md` and updated API contracts. No new packages, schema changes, production migrations or production file/data rewrites.

## Validation

- Node.js v26.13.0, 26 test files / **187 tests passed**. Final run uses one worker: earlier concurrent/loaded-machine runs timed out while initializing isolated SQLite fixtures; no production DB was reset or seeded.
- TypeScript checks for root and web passed.
- Production build passed; 42 manifest traces / 17,847 runtime file references verified with no missing/build-only entries.
- **18 Chrome checks passed** against compiled local production server and separate test DB: existing edit/save/reload/import/revision flow; bottom-up MCQ under misleading true/false section; exact point total; desktop light/dark and mobile 375px reduced motion; upload/reader/four-category export with matching context and retained essay; guest denial; no browser runtime errors.
- Regression examples cover glued units and questions, A/C/B/D, inferred labels, partial verdict tables, true/false lone statement and grouped keys, short questions without numbering, essay subparts, source-number preservation, real Word table extraction and export ownership.
- Provider interactions are deterministic fixtures in tests, not a claim of live AI-solver accuracy.
- Read-only reviewer was attempted but expired authentication prevented a completed report. No independently clean review claimed. Manual code/contract checks and regressions completed.

## Limits retained intentionally

- No arbitrary numeral restoration such as `D15/0` becoming `D. 15/10`; unresolved OCR data require source verification.
- Inferred labels need teacher confirmation before preparation/publication. PDF color/complex OCR/layout still require valid visual evidence.
- ESSAY classification/export is delivered, not a new automated essay grading/publication contract.
- AI answer/solution completion requires user-selected AI mode; four-category deterministic export does not silently solve or send documents to a model.
- Four-category JSON maps existing fill/short to SHORT_ANSWER and choice types to MULTIPLE_CHOICE; existing quiz engine/contracts remain intact.