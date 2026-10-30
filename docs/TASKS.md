# StudyForge AI — Task Plan & Ownership

## Image attachments in the assistant
- Owner: Codex. Lifecycle: todo -> ready -> running -> review -> done.
- Add file/paste/drop image selection and previews; validate bounded raster data and stream real vision responses through the existing authenticated 9Router gateway.
- Verified: 85 automated tests, type checking, production build and nine real-image browser checks. High vision read an unpredictable code in 8.1s; the same PNG also uploaded and OCRed through the document-library UI. See `team/reports/07-assistant-images.md`.

## Reliable saving, smoother workspace and embedded assistant
- Owner: Codex. Lifecycle: todo -> ready -> running -> review -> done.
- Reproduce large-quiz saves, batch atomic persistence and safe retries, audit navigation/review performance, research GitHub document tools, add source-only creation/structured exports and Lucian #215 streaming 9Router help.
- Verified: 82 automated tests; 21 auth, 19 quiz, 14 document and 14 workspace browser checks; type checking and production build. Actual 100-question save: 4.8s in final run; source-only creation: 1.2s; actual chat: 7.7s. Docling connector is optional and contract-tested, not installed/live-benchmarked. See `team/reports/06-saving-assistant-performance.md`.

## Faithful document analysis and faster Flash High generation
- Owner: Codex. Lifecycle: todo -> ready -> running -> review -> done.
- Preserve DOCX lists/tables, classify Roman sections and uppercase true/false, read inline/global keys, flag unsupported/ambiguous items, add OCR and original-file inspection, batch/cache/resume generation with real streamed progress, validate real document speed and browser flows.
- Verified: 71 tests, typecheck/build, 21 auth browser checks, 19 quiz browser checks and 14 real-provider document browser checks. Six history questions took 26.4s; four mixed-format items through the website took 17s. Neon WebSocket transport restores the same database connection. Details and limits: `team/reports/05-document-reading-and-speed.md`.

## Database closed-connection recovery
- Owner: Codex. Lifecycle: todo -> ready -> running -> review -> done.
- Recover transient document/session reads safely, use Neon connection timeouts, and return sanitized errors without replaying writes or disconnecting other requests.

## Mixed-format AI quiz creation and Lucian UI
- Owner: Codex. Implementation lifecycle: todo -> ready -> running -> review -> done.
- Real provider validation lifecycle: todo -> ready -> running -> review -> done. Saved 9Router key verified; `ag/gemini-3.8-flash-high` is the default. Real generation, extraction, and the authenticated website endpoint all passed. See `docs/QUIZ_AI_SETUP.md`; browser review fixtures remain separate from these real-provider checks.
- Recognize source sections, preserve original questions, validate AI explanations/citations, require review, and use Lucian #042/#015/#219 for the builder and theme reveal.

## Google sign-in and account persistence
- Implementation and local validation lifecycle: todo -> ready -> running -> review -> done.
- Database / OAuth configuration lifecycle: todo -> ready -> running -> review -> done. Google project `studyforge-ai-512309`, Web OAuth client and test user configured; Neon connected and existing SQLite data imported with verification.
- Existing Google account linking lifecycle: todo -> ready -> running -> review -> done. Matching local-account authentication completed; Google linking and a subsequent Google-only sign-in succeeded, preserved the account ID/password hash, and issued a new session.
- Owner: Codex. Add verified Google OAuth, persistent accounts/sessions, safe password handling, and isolated database tests. Online activation requires the project's Google OAuth credentials and PostgreSQL connection.

## Milestone 0: Environment & Protocol Setup
- [x] Survey Windows environment, Node v24, Git, Codex CLI, Lucian skill. (Owner: Gemini)
- [x] Create project documentation: PRD, ARCHITECTURE, CONTRACTS, AGENTS. (Owner: Gemini)
- [x] Create Task 01 prompt for Codex CLI. (Owner: Gemini)

## Milestone 1: Core Framework, DB, Auth & Contracts Skeleton
- [x] Task 01: Project structure, package.json, TypeScript, Prisma schema, Auth implementation & DAL skeleton. (Owner: Codex CLI + Gemini)
- [x] Verify Task 01 execution, exit code, diff, and contract adherence (9/9 tests passed). (Owner: Gemini)

## Milestone 2: Backend Engines & Frontend UI Modules
- [ ] Task 02: Document parser (PDF/DOCX/TXT), Question Generation Engine (9Router AI gateway adapter), Grading engine & Attempt shuffle. (Owner: Codex CLI)
- [ ] Task 03: Lucian UX/UI elements porting, App shell, Responsive layouts (375px+), Auth screens, Dashboard, Upload screen, Quiz Builder & Quiz Taking views. (Owner: Gemini)

## Milestone 3: End-to-End Integration
- [ ] Wire frontend forms with backend API routes and real database.
- [ ] Complete flow: Register -> Login -> Upload Document -> Inspect & Edit Extracted Text -> Configure Quiz -> AI Generation -> Review & Publish -> Join via Link -> Take Exam -> Submit -> Review Score & Retry Incorrect. (Owner: Gemini + Codex)

## Milestone 4: Comprehensive Code Review & Hardening
- [ ] Task 90: Codex independent read-only review of entire codebase. (Owner: Codex CLI)
- [ ] Fix identified findings, security hardening, and verification re-run. (Owner: Gemini + Codex)

## Milestone 5: Handover & Documentation
- [ ] Seed data: Sinh học 8, Địa lí 8, and University module.
- [ ] Developer scripts: dev.ps1, doctor.ps1, run-codex-task.ps1.
- [ ] Comprehensive testing and handover documentation. (Owner: Gemini)
