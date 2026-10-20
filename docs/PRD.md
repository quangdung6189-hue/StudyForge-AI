# StudyForge AI — Product Requirements Document (PRD)

## 1. Executive Summary
StudyForge AI is an intelligent study workspace and assessment generator tailored for Vietnamese students, teachers, and learners. It ingests educational documents (PDF, scanned PDF, DOCX, TXT, images) and produces validated quizzes, interactive question banks, spaced-repetition flashcards, and automated grading with verifiable citations.

## 2. Core User Flows
1. **Authentication**:
   - Register (Email/Password) -> Email verification -> Login -> Password reset.
   - Strict session check across all functional pages. No guest mode.
2. **Document Ingestion**:
   - Drag-and-drop multiple files (PDF text/scan, DOCX, TXT, JPG, PNG).
   - Server-side parsing & chunking with Vietnamese diacritics preservation.
   - User reviews & edits extracted text before quiz generation.
3. **Assessment Configuration**:
   - Choose mode: "Keep original quiz" (exact import) OR "AI-generated quiz from study material".
   - Select question types: Single-choice, multiple-choice, true/false, fill-in-blank, short answer.
   - Select difficulty distribution: Recognition (Nhận biết), Comprehension (Thông hiểu), Application (Vận dụng).
4. **AI Generation & Verification Pipeline**:
   - Extraction -> Chunking -> Relevance retrieval -> JSON Schema generation -> Ground-truth verification & source citations (`sourceRefs`) -> Critique step.
   - Distinct labeling: `document` (original), `teacher` (authored), `ai_suggested` (needs review).
5. **Review & Publishing**:
   - Full question editor: stems, options, explanations, citations, points, reordering.
   - Publication creates immutable `QuizVersion` (changes don't invalidate in-progress attempts).
6. **Taking Assessment**:
   - Shareable link/code requiring user sign-in.
   - Per-attempt deterministic shuffle seed for questions and options.
   - Server-enforced start time, duration, and deadline.
   - Periodic autosave of answers; zero leaks of correct answers or explanations before submission.
7. **Grading & Review**:
   - Idempotent submission & grading transactions.
   - Score breakdown by topic, explanation review, and "Luyện lại câu sai" (targeted review of incorrect answers).

## 3. Security & Non-Negotiables
- Server-side permission check on every DAL query and route handler (no ID-swap privilege escalation).
- AI credentials restricted strictly to server backend (`AI_BASE_URL`, `AI_API_KEY`).
- Rate limiting on sensitive endpoints (auth, file upload, AI generation, quiz attempts).
- Responsive mobile experience down to 375px; WCAG 2.2 AA accessibility; reduced motion support.
