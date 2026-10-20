# StudyForge AI — System Architecture & Boundaries

## 1. Directory Structure & File Boundaries

```
apps/
  web/                     # Next.js App Router (React, TypeScript)
    src/
      app/
        (public)/          # Landing page & policies
        (auth)/            # Sign-in, sign-up, verify, reset-password
        (workspace)/       # Dashboard, documents, quizzes, study, classes, results
        api/               # Next.js Route Handlers with Auth/RBAC checks
      components/
        lucian/            # Ported Lucian UI elements with scoped CSS
        layout/            # App shell, desktop sidebar, mobile nav
      features/            # Domain UI modules, hooks, client API
      server/
        auth/              # Session management, password hashing, token validation
        dal/               # Data Access Layer with resource ownership enforcement
        services/          # Application use cases (business logic)
      styles/              # Globals, typography, Lucian tokens mapping
packages/
  contracts/               # Shared Zod schemas, request/response DTOs (Public)
  core/                    # Domain logic: grading engine, deadline rules, seed shuffle
  db/                      # Prisma schema, migrations, seeds, client export
  ai/                      # 9Router / Gemini AI client, structured outputs, prompts
  storage/                 # Private file storage adapter (local / S3-compatible)
docs/                      # Specifications, contracts, QA logs
team/
  prompts/                 # Codex task dispatches
  reports/                 # Codex execution reports
scripts/                   # PowerShell orchestration, dev runners, health checks
```

## 2. Data Flow
1. Client -> Next.js Route Handler / Server Action.
2. Auth Guard checks session cookie & user identity (`userId`, `role`).
3. Zod validation (`packages/contracts`) validates input body.
4. Service Layer executes use-case logic, invoking domain functions in `packages/core`.
5. DAL layer interacts with database (`packages/db`), filtering strictly by ownership or authorized membership.
6. External AI interactions route through `packages/ai` via server-side 9Router gateway.
7. File uploads stream to private storage via `packages/storage`.

## 3. Threat Model & Mitigations
- **Privilege Escalation**: Every query explicitly filters by authenticated `userId` or validated class membership.
- **Cheat Prevention**: Exam attempt endpoints return questions and options with randomized transient IDs and exclude `isCorrect` / `explanation` fields.
- **Deadline Enforcement**: Submission evaluation calculates `now <= Math.min(startedAt + duration, deadline)`.
- **Idempotency**: Submissions are guarded by unique constraints on `AttemptId` and database transaction locks.
