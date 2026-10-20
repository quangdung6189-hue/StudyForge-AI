# AGENTS.md — StudyForge AI Team Protocol

## Project Overview
StudyForge AI transforms PDFs, DOCX, TXT, and scanned study materials into structured question banks, customized quizzes, and spaced repetition review sets.

## Team Roles & Ownership

### 1. Gemini (Coordinator, UX/UI Designer & Frontend Integrator)
- **Role**: Lead Coordinator, UX/UI Designer, Frontend Integrator.
- **Responsibilities**:
  - User journeys and wireframes following `lucian-uxui` skill.
  - Port Lucian elements using exact tokens (`--ux-*`) and CSS scoped rules.
  - Implement Next.js app shell, views, forms, client validations, accessible keyboard & mobile layouts (375px+).
  - Connect client with real backend API contracts (no mock backends).
  - Terminal orchestration: dispatch tasks to Codex CLI via `team/prompts/` and read reports from `team/reports/`.
  - Resolution of conflicts and integration oversight.

### 2. Codex (Architect, Backend & Reviewer)
- **Role**: Architect & Backend Engineer (via `codex exec --sandbox workspace-write`), Independent Reviewer (via `codex exec --sandbox read-only`).
- **Responsibilities**:
  - Workspace scaffolding, TypeScript setup, contracts, schemas.
  - PostgreSQL / Prisma schema, migrations, seed, DAL, transactions.
  - Auth enforcement (Session-based, RBAC: Student, Teacher, Admin), zero guest bypass.
  - Document ingestion, chunking, question generation pipeline, AI gateway (9Router/Gemini), grading engine, deterministic shuffle seeds, server-controlled deadlines.
  - Comprehensive integration tests.
  - Final repository review with structured findings (severity, file/line, repro, remediation).

## Boundaries & Golden Rules
1. **No Guest Mode**: Every product feature (upload, quiz generation, study, taking quiz via shared link, results) requires an authenticated session.
2. **Security & Permissions**: Checked at backend DAL/route handler level, not just UI.
3. **AI Keys**: Server-side only (`AI_BASE_URL`, `AI_API_KEY`). Never expose in `NEXT_PUBLIC_*` or client bundles.
4. **Answer Ground Truth**: Differentiate original document answers vs AI-suggested answers (`answerOrigin: "document" | "teacher" | "ai_suggested"`). Require `sourceRefs` with textual citations.
5. **Exam Confidentiality**: During active exams, correct answers, explanations, and secret keys MUST NOT be returned in JSON/HTML/RSC payloads.
6. **Task Execution Lifecycle**: `todo` -> `ready` -> `running` -> `review` -> `done`.
