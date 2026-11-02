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
- All endpoints require an authenticated session. Upload IDs are bound to the authenticated owner; no client-supplied owner ID is accepted.
- `POST /api/documents/uploads`:
  - JSON: `{ filename: string, size: number }` (1 byte–25 MiB, PDF/DOCX/TXT/PNG/JPG).
  - Response 201: `{ uploadId: string, partBytes: 1048576 }`.
  - Expiry: 1 hour; max 10 incomplete uploads per owner; DB-backed upload rate limit.
- `PUT /api/documents/uploads/:id`:
  - Binary body, `Content-Type: application/octet-stream`, `X-Upload-Part: 0` (zero-based, sequential).
  - Each part is exactly `min(partBytes, remainingBytes)`, with a server-enforced stream limit of 1 MiB. Identical retries are idempotent; changed bytes or wrong order return 409.
  - Response: `{ receivedBytes: number, nextPart: number }`.
- `POST /api/documents/uploads/:id/complete`:
  - No file bytes in the request. Server validates all parts, parses the original, then atomically saves document, text chunks, private binary original and extraction metadata.
  - Response: `{ success: true, documents: Array<{ id, title, fileType, size, status, chunkCount, warnings, counts }> }`.
  - Successful retries return the existing document, not a duplicate. Concurrent finalization returns 409; failed parsing leaves the parts available until cancellation/expiry.
- `DELETE /api/documents/uploads/:id`: cancels only the caller's incomplete upload, removes parts, returns 204. Processing/completed documents are not deleted.
- `GET /api/documents/:id/file`: authenticated owner only; private streaming response, supports one HTTP byte range for PDF readers (206/416).
- `POST /api/documents/upload`:
  - Legacy multipart compatibility only: `files: File[]` (max 10). Uses the same database storage. Large requests may be rejected by Vercel before the handler; the UI uses chunked endpoints above instead.
  - Response: `{ success: true, documents: Array<{ id, title, fileType, size, status, chunkCount, warnings, counts }> }`.
- `GET /api/documents`:
  - Query: `page`, `limit`
  - Response: `{ items: DocumentDTO[], total: number }`
- `GET /api/documents/:id`:
  - Response: `{ id, title, rawText, chunks: Array<{ id, chunkIndex, content, pageNumber }>, status }`
- `PATCH /api/documents/:id`:
  - Request: `{ title?: string, rawText?: string }`
  - Response: `{ success: true, document: DocumentDTO }`
- `GET /api/documents/:id/export?format=exam-pro`:
  - Authenticated owner only. Private/no-store JSON attachment using `studyforge.exam-parser-pro.v1`.
  - Includes `exam_metadata`, four-category `questions`, source numbering/text, diagnostics and review flags. Unknown answer/subject/grade stays null. Does not invoke AI, modify stored documents or publish essays.
  - Existing `format=json|csv|md` exports remain available.

## 3. Quiz Generation & Management
- `GET /api/exam-drafts`: owner-scoped recent structured editor drafts (max 20), never another user's content.
- `POST /api/exam-drafts`: `{ id: UUID, code: string <= 250000, title, minutes: 1..1440, revision, sourceDocumentId: UUID | null }`. Incomplete questions are allowed. Response contains the saved revision and timestamp. Stale different content returns 409; identical lost-response retries reuse saved content.
- `GET /api/exam-drafts/:id`: restores the authenticated owner's code/settings/revision. No guest bypass.
- `POST /api/exam-drafts/:id/prepare`: `{ revision, excludeManual?: boolean }` (default false). Rejects missing/conflicting answer keys and unsupported structures, with separate diagnostics for answered essays requiring manual grading. An explicit `excludeManual: true` prepares only supported automatic questions; preserves every original question/model answer in the saved draft and immutable source snapshot, returns `{ documentId, questions, excludedManualCount }`. Empty automatic selections and unresolved automatic keys remain blocked. Actual citations and `reviewed: false` retained. True/false substatements use the existing two-option grading contract. Explicit `[type:short]`/`[type:fill]` is a teacher-selected grading mode, not a parser-invented conversion from essays; `[type:essay]` preserves manual classification on roundtrip.
- `POST /api/code-exam`: legacy adapter now uses the same parser and validated draft workflow. It does not publish or select choice A when a key is missing. Valid requests save an unpublished quiz requiring review.
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
