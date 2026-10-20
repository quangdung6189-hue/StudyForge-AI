# Task 01 Report — Architecture, Backend, Database and Contracts

**Status**: `done` (Lifecycle: `todo` → `ready` → `running` → `done`)
**Architect & Backend**: Codex CLI + Gemini Coordinator
**Date**: 2026-10-21

## 1. Summary of Delivered Modules

### `packages/contracts`
- Zod schemas and TypeScript types for `User`, `Document`, `Question`, `QuestionOption`, `Quiz`, `QuizVersion`, and `Attempt`.
- `StudentAttemptQuestionSchema`: Explicit allowlist excluding `correctOptionIds`, `acceptedAnswers`, `explanation`, and `answerOrigin` to prevent exam leaks.
- Ground-truth citation schema (`SourceRefSchema` requiring `chunkId` and `quote`).

### `packages/core`
- `attemptDeadline`: Resolves the earlier timestamp between `startedAt + durationMinutes` and the quiz deadline.
- `seededShuffle`: Fisher-Yates algorithm seeded with SHA-256 for deterministic question/option shuffling without modulo bias.
- `transientId`: HMAC-SHA256 masked IDs for exam attempts.
- `studentQuestions` & `decodeAnswers`: Opaque projection and real-ID decoding.
- `grade`: Strict grading engine for single, multiple, boolean, and text questions.
- `assertCitations`: Enforces quotes to match real document chunks.
- `chunkText`: Vietnamese diacritic-safe text chunking.

### `packages/db`
- Prisma schema with models: `User`, `Session`, `VerificationToken`, `Document`, `DocumentChunk`, `QuestionBank`, `Question`, `QuestionOption`, `Quiz`, `QuizVersion`, `Attempt`, `AttemptAnswer`, `RateLimitBucket`.
- Dual database support: Production PostgreSQL with seamless SQLite local fallback (`.data/dev.db`).
- `scripts/db.mjs`: Automated generation for both engines.

### `packages/ai`
- `AIGateway`: 9Router / Gemini client supporting OpenAI-compatible structured output via JSON Schema.
- Server-side only enforcement; zero API keys exposed to client bundles.

### `packages/storage`
- `LocalPrivateStorage`: Traversal-resistant private binary storage with persistent ownership validation callback.

### `apps/web/src/server`
- `auth.ts`: Password hashing (bcrypt <= 72 bytes), HttpOnly session cookies, `requireUser` guard (zero guest bypass).
- `dal.ts`: Ownership-checked queries, immutable `QuizVersion` publishing, attempt generation, and idempotent submissions.
- `extractor.ts`: Multi-format parsing for PDF, DOCX, and TXT with Vietnamese tone normalization (NFC).
- `generator.ts`: AI question generation pipeline with citation grounding and offline deterministic fallback.

### API Routes
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
- Documents: `/api/documents`, `/api/documents/upload`, `/api/documents/[id]`.
- Quizzes: `/api/quizzes`, `/api/quizzes/generate`, `/api/quizzes/[id]`, `/api/quizzes/[id]/publish`.
- Attempts: `/api/attempts/start`, `/api/attempts/[id]/save-answers`, `/api/attempts/[id]/submit`.

## 2. Verification & Test Results
- Ran `vitest run`:
  - `tests/core.test.ts`: 5 passed.
  - `tests/auth_dal.test.ts`: 4 passed (bcrypt, sessions, ownership isolation, exam attempt lifecycle).
  - Total: **9 passed (100% green)** in 1.44s.
- Ran `npm run db:seed`:
  - Teacher: `giaovien@studyforge.vn` / `GiaoVien2026!`
  - Student: `hocsinh@studyforge.vn` / `HocSinh2026!`
  - Sample Quiz Share Code: `SINHHOC8DEMO`

## 3. Next Milestone (Milestone 2 & 3)
- Gemini integrates Lucian UX/UI (`lucian-uxui` skill tokens and scoped CSS):
  - App shell, sidebar navigation, responsive layout down to 375px.
  - Authentication forms (Sign-in, Sign-up).
  - Document upload and text inspection/editor.
  - Quiz generation and review screens.
  - Exam taking screen with countdown timer, autosave, and question navigator.
  - Result screen with score breakdown, explanations, citations, and incorrect answer retry.
