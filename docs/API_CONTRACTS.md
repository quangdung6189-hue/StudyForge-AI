# StudyForge AI — API Contracts & DTOs

## 1. Authentication Endpoints
- `POST /api/auth/register`:
  - Request: `{ email: string, password: string, name: string, role?: "student" | "teacher" }`
  - Response: `{ success: true, message: "Verification email sent", userId: string }`
- `POST /api/auth/verify-email`:
  - Request: `{ token: string }`
  - Response: `{ success: true, verified: true }`
- `POST /api/auth/login`:
  - Request: `{ email: string, password: string }`
  - Response: `{ success: true, user: { id, email, name, role } }` (Sets HttpOnly session cookie)
- `POST /api/auth/logout`:
  - Response: `{ success: true }` (Clears session cookie)
- `GET /api/auth/me`:
  - Response: `{ authenticated: boolean, user?: { id, email, name, role } }`

## 2. Document Endpoints
- `POST /api/documents/upload`:
  - Form-data: `files: File[]`, `title?: string`
  - Response: `{ documents: Array<{ id, title, fileType, size, status: "uploaded" | "extracting" | "ready" }> }`
- `GET /api/documents`:
  - Query: `page`, `limit`
  - Response: `{ items: DocumentDTO[], total: number }`
- `GET /api/documents/:id`:
  - Response: `{ id, title, rawText, chunks: Array<{ id, chunkIndex, content, pageNumber }>, status }`
- `PATCH /api/documents/:id`:
  - Request: `{ title?: string, rawText?: string }`
  - Response: `{ success: true, document: DocumentDTO }`

## 3. Quiz Generation & Management
- `POST /api/quizzes/generate`:
  - Request: `{ documentId: string, mode: "extract_existing" | "ai_generate", questionCount: number, types: ("single"|"multiple"|"boolean"|"fill")[], difficultyDistribution?: { recognition: number, comprehension: number, application: number } }`
  - Response: `{ draftId: string, status: "completed" | "processing", questions: QuestionDraftDTO[] }`
- `GET /api/quizzes`:
  - Response: `{ items: QuizSummaryDTO[] }`
- `GET /api/quizzes/:id`:
  - Response: `{ id, title, description, isPublished, shareCode, durationMinutes, questions: FullQuestionDTO[] }`
- `POST /api/quizzes/:id/publish`:
  - Request: `{ durationMinutes?: number, deadline?: string, allowReview: boolean }`
  - Response: `{ success: true, versionId: string, shareUrl: string, shareCode: string }`

## 4. Exam Taking & Attempt Endpoints (Strict Security)
- `POST /api/attempts/start`:
  - Request: `{ quizId?: string, shareCode?: string }`
  - Response: `{ attemptId: string, quizTitle: string, durationMinutes: number, startedAt: string, expiresAt: string, questions: StudentAttemptQuestionDTO[] }`
  - **CRITICAL**: `StudentAttemptQuestionDTO` MUST NOT contain `correctOptionIds`, `isCorrect`, or `explanation`!
- `POST /api/attempts/:attemptId/save-answers`:
  - Request: `{ answers: Record<string, string[]> }` (questionId -> selectedOptionIds)
  - Response: `{ savedAt: string, status: "saved" }`
- `POST /api/attempts/:attemptId/submit`:
  - Request: `{ answers: Record<string, string[]> }`
  - Response: `{ attemptId: string, submittedAt: string, score: number, totalPoints: number, passed: boolean, details?: AttemptGradedResultDTO }` (details included only if quiz review policy permits)
