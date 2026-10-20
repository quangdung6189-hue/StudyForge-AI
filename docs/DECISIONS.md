# Architectural Decisions Record (ADR)

## ADR-01: Framework and Workspace Architecture
- **Context**: Need a cohesive full-stack web application with fast development iteration on Windows, strong type safety, and clear boundary separation.
- **Decision**: Next.js App Router (TypeScript) with modular structure (`packages/contracts`, `packages/core`, `packages/db`, `packages/ai`, `packages/storage`), with app routes cleanly divided into `(public)`, `(auth)`, `(workspace)`, and `/api`.
- **Status**: Accepted.

## ADR-02: Database & Data Access Layer
- **Context**: Need reliable schema migrations, transactions for idempotent quiz submissions, and flexible local development without mandatory Docker daemon.
- **Decision**: Prisma ORM. Configure standard PostgreSQL support with connection string from environment (`DATABASE_URL`), and compatible SQLite fallback if Docker/Postgres is unavailable locally. All queries must enforce user ownership in the DAL.
- **Status**: Accepted.

## ADR-03: Lucian UX/UI Integration
- **Context**: UI must be polished, accessible, responsive (375px+), and strictly preserve CSS/motion/license from `lucian-uxui`.
- **Decision**: Port Lucian elements using `--ux-*` token mapping with scoped CSS. Keep MIT license header on each element.
- **Status**: Accepted.

## ADR-04: AI Gateway & Citations Integrity
- **Context**: Need multi-model flexibility, security of AI credentials, and ground-truth validation for quiz generation.
- **Decision**: AI integration routes via server-side 9Router gateway (`AI_BASE_URL`, `AI_API_KEY`). Quiz questions must retain explicit citations (`sourceRefs`) pointing to document text chunks, with answer origin explicitly marked (`document` vs `teacher` vs `ai_suggested`).
- **Status**: Accepted.
