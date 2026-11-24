# Learning suite — tính năng tạo đề, làm bài và ôn luyện (2026-11)

Tài liệu cho người vận hành và lập trình viên. Mọi quyền đều kiểm tra ở tầng DAL (`apps/web/src/server/learning.ts`, `data-access.ts`), không chỉ ở giao diện.

## Bắt buộc trước khi triển khai

Migration cộng thêm (không xoá/sửa dữ liệu cũ): `packages/db/prisma/migrations/20261125000000_learning_suite`.

```bash
# với DATABASE_URL của môi trường cần nâng cấp (PostgreSQL)
npm run db:migrate
npm run db:generate
```

Mã mới đọc các cột mới của `Quiz`, `Question`, `AttemptAnswer` — **phải chạy migration trước khi deploy**, nếu không phòng thi sẽ lỗi. Dev cục bộ với SQLite: `npm run db:push`.

## 15 tính năng

| # | Tính năng | Giao diện | API / DAL |
|---|---|---|---|
| 1 | Đánh dấu "xem lại sau" (phím F), lọc câu đánh dấu | Phòng thi | lưu trên máy (`localStorage`) |
| 2 | Ôn lại câu sai → bộ thẻ ôn tập | Màn kết quả | `POST /api/study/decks {source:'attempt'}` — chỉ khi đề cho xem đáp án |
| 3 | Chia sẻ mã + QR, tải ảnh QR, Web Share | Ngân hàng đề, bước Hoàn tất | `uqr` (client) |
| 4 | Hộp xác nhận & thông báo thống nhất | Toàn app (`useFeedback()`) | — |
| 5 | Báo mất mạng, tạm dừng/tiếp tục tự lưu | Toàn app, phòng thi | `useOnline()` |
| 6 | Lặp lại ngắt quãng SM-2 lưu DB, chuỗi ngày học | `/study` | `GET /api/study`, `POST /api/study/review`, `POST /api/study/decks` |
| 7 | Luyện tập phản hồi ngay, khoá câu đã kiểm tra | Phòng thi (đề chế độ luyện tập) | `POST /api/attempts/[id]/check` — từ chối với đề kiểm tra |
| 8 | Lịch sử mọi lượt nộp, biểu đồ tiến bộ | `/history` | bảng `AttemptRecord` (làm lại không ghi đè) |
| 9 | Thống kê lớp: phân bố điểm, tỉ lệ đúng, độ phân biệt D, phương án nhiễu, CSV | `/quizzes/[id]/analytics` | `GET /api/quizzes/[id]/analytics(?format=csv)` — chỉ chủ đề |
| 10 | Nhiều mã đề (xáo trộn tất định), in/PDF, Word kèm đáp án | `/quizzes/[id]/print` | `GET /api/quizzes/[id]/export?versions=N&key=1` |
| 11 | Ma trận đề dạng câu × mức độ | Trình tạo đề → "Sinh câu mới theo ma trận" | `matrix` trong `QuizGenerateSchema` |
| 12 | Lớp học, mã/QR mời, giao bài có hạn nộp; giờ mở phòng & giới hạn lượt | `/classes`, `/classes/[id]`, modal Tuỳ chỉnh | `/api/classes/*`, `/api/assignments`; `opensAt`, `maxAttempts` kiểm tra khi vào thi |
| 13 | Kho câu hỏi có thẻ, lọc, ghép đề mới | `/bank` | `/api/bank*` — câu ghép phải cùng tài liệu nguồn (giữ trích dẫn kiểm chứng) |
| 14 | AI gợi ý chấm trả lời ngắn theo rubric, giáo viên xác nhận | `/quizzes/[id]/grading` | gợi ý lưu `ai_suggested`, chỉ điểm `confirmed` mới tính |
| 15 | Dạng câu Sắp xếp thứ tự, Ghép nối (chấm từng cặp), âm thanh nghe hiểu | Trình tạo đề (soạn thủ công + trích dẫn), phòng thi | `AnyQuestionTypeSchema`, `POST/GET /api/media` |

## Quy tắc giữ nguyên

- **Bảo mật đề thi:** payload làm bài (`studentQuestions`) không chứa đáp án, cặp ghép hay lời giải; ID là ID tạm theo lượt. Chỉ đề luyện tập mới trả đáp án trước khi nộp.
- **Nguồn gốc đáp án:** câu giáo viên soạn là `teacher`, câu AI là `ai_suggested`; gợi ý chấm của AI không bao giờ tự cộng điểm.
- **Trích dẫn:** câu soạn thủ công bắt buộc dán đoạn nguyên văn có trong tài liệu (`assertCitations`).
- AI không sinh dạng sắp xếp/ghép nối (chỉ `QuestionTypeSchema` 5 dạng gốc).

## Kiểm thử

`npx vitest run tests/learning-suite.test.ts` — chạy trên SQLite cô lập trong `.data/`, không chạm DB thật.
