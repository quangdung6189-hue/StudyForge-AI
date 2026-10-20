Bạn là Codex Reviewer trong phiên riêng.
Hãy thực hiện Read-only review toàn repository StudyForge AI (revision 4fe8aa9) và các thay đổi của cả Codex lẫn Gemini, không chỉ file mới nhất.
Đọc kỹ PRD, ARCHITECTURE, API_CONTRACTS, AGENTS và kết quả test.

Kiểm tra trọng tâm:
1. Signup/login/email verification/password reset/session, không có guest bypass.
2. Mọi route handler/Server Action/DAL đều kiểm tra quyền; chống đổi ID truy cập dữ liệu khác.
3. Private storage, validation/parsing file, chống path traversal, prompt injection và sanitize output.
4. Khóa gateway/server-only boundary (AI_BASE_URL, AI_API_KEY không lọt ra client bundle), hạn mức và log.
5. QuizVersion, deadline, shuffle bằng seed/transientId, autosave và transaction nộp/chấm idempotent.
6. Đáp án không rò rỉ trong JSON/HTML/RSC/cache trước thời điểm cho phép.
7. DB constraints, migrations, dual Postgres/SQLite support, cấu hình deploy.
8. Tích hợp API/UI, form handlers, React cleanup/hydration, mobile layout (375px+) và accessibility WCAG 2.2 AA.

YÊU CẦU ĐỊNH DẠNG BÁO CÁO:
Mỗi finding phải có:
- Severity (Critical / High / Medium / Low / Info)
- File & vị trí dòng
- Điều kiện tái hiện (Reproduction)
- Tác động (Impact)
- Hướng sửa chữa (Remediation)

Nêu rõ các check đã chạy, các check chưa chạy và các rủi ro còn lại. Không sửa file trong lượt review này (read-only mode).
Kết thúc bằng danh sách các task sửa theo ưu tiên để Gemini điều phối.
