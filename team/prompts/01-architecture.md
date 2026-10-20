Bạn là Codex, phụ trách Architect/Backend cho StudyForge AI.
Hãy đọc kỹ AGENTS.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/API_CONTRACTS.md, docs/ENVIRONMENT.md.

MỤC TIÊU NHIỆM VỤ 01:
1. Dựng nền tảng dự án (Next.js App Router, TypeScript, package.json, tsconfig.json, Next configuration).
2. Tạo các package/module theo cấu trúc đặc tả:
   - packages/contracts: Zod schemas & DTOs cho Auth, Documents, Quizzes, Attempts (nhớ: DTO cho học sinh làm bài KHÔNG chứa đáp án đúng hoặc lời giải).
   - packages/core: Domain logic tính điểm (grading), thời gian hết hạn (deadline Math.min(startedAt+duration, quizDeadline)), xáo trộn câu hỏi & đáp án theo seed (deterministic shuffle).
   - packages/db: Prisma schema và Prisma client wrapper (hỗ trợ các model: User, Session, VerificationToken, Document, DocumentChunk, QuestionBank, Question, QuestionOption, Quiz, QuizVersion, Attempt, AttemptAnswer). Hỗ trợ chạy mượt mà trên môi trường Windows với database url từ .env.
   - packages/ai: AI gateway adapter gọi 9Router/Gemini tương thích OpenAI API (chat completions với JSON schema response), cấu hình qua AI_BASE_URL, AI_API_KEY, AI_MODEL_GENERATE, AI_MODEL_REVIEW.
   - packages/storage: Adapter lưu trữ file nội bộ an toàn (private local storage với access control check).
3. Backend Server & DAL cho apps/web:
   - Server auth: mã hóa mật khẩu, session token an toàn, cookie HttpOnly, đăng ký/đăng nhập/đăng xuất/xác minh, kiểm tra session bắt buộc cho toàn bộ tính năng. Không có guest mode.
   - DAL: Truy vấn dữ liệu có kiểm tra quyền sở hữu (ownership check) hoặc quyền tham gia đề thi (join code check). Không cho phép ID-swap.
   - Route handlers API:
     + /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me
     + /api/documents, /api/documents/upload, /api/documents/[id]
     + /api/quizzes, /api/quizzes/generate, /api/quizzes/[id], /api/quizzes/[id]/publish
     + /api/attempts/start, /api/attempts/[id]/save-answers, /api/attempts/[id]/submit
4. Tạo .env.example đầy đủ các biến môi trường cấu hình (không để lộ bí mật).
5. Viết bài test hoặc kịch bản kiểm tra tự động cho auth/permission/grading.

YÊU CẦU:
- Thực hiện đầy đủ code thực tế, không dùng placeholder rỗng.
- Giữ giao diện UI tối thiểu để Gemini xây dựng UI theo skill Lucian UX/UI.
- Ghi báo cáo cụ thể (các file đã tạo, diff, lệnh kiểm tra, contract, các lưu ý) vào báo cáo cuối.
