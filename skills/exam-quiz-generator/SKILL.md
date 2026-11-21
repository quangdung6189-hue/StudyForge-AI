---
name: exam-quiz-generator
description: Design, generate, validate, and publish Vietnamese quizzes and exams in StudyForge AI. Use for AI question generation pipeline, extract_existing mode, balance/difficulty matrix (recognition, comprehension, application), strict ground-truth answer provenance (document vs ai_suggested), citation enforcement (sourceRefs), confidential exam taking payloads, and streaming generation.
---

# Exam-Quiz-Generator — Quy chuẩn và Kiến trúc Tạo Bài Kiểm Tra

## Vai trò và phạm vi

Đảm nhiệm toàn bộ quy trình **tạo bài kiểm tra (Quiz & Exam Generation)** từ tài liệu học tập, bao gồm:
1. Sinh câu hỏi tự động bằng AI (`ai_generate`).
2. Trích xuất và giải đề có sẵn từ tài liệu (`extract_existing`).
3. Tự động phân tích, chuẩn hóa phân loại 4 nhóm câu hỏi và giải đáp án còn thiếu (`ai_analyze`).
4. Cân đối ma trận độ khó theo chuẩn GDPT (Nhận biết, Thông hiểu, Vận dụng).
5. Kiểm soát nguồn gốc đáp án (*Answer Provenance*): phân định minh bạch giữa đáp án gốc tài liệu (`document`) và đáp án do AI đề xuất (`ai_suggested`).
6. Kiểm chứng trích dẫn nghiêm ngặt (*Citation Grounding*): mỗi câu hỏi bắt buộc có `sourceRefs` chứa `chunkId` và `quote` nguyên văn từ tài liệu nguồn.
7. Bảo mật đề thi: Không rò rỉ đáp án/lời giải trong phiên làm bài thi đang mở; mã hóa xáo trộn ngẫu nhiên tất định (*Deterministic Shuffling Seed*).

Đọc `AGENTS.md`, `skills/exam-document-reader/SKILL.md` và `skills/exam-parser-pro/SKILL.md` trước khi sửa đổi pipeline tạo bài.

---

## 1. Ba Chế Độ Tạo Đề (Core Generation Modes)

### 1.1 Tạo câu hỏi mới từ tài liệu (`ai_generate`)
- **Mục đích**: Chuyển đổi giáo trình, bài giảng, tài liệu ôn tập thành đề thi trắc nghiệm mới.
- **Quy tắc**:
  - Chỉ tạo câu hỏi từ kiến thức có trong các `chunks` của tài liệu; tuyệt đối không bịa đặt dữ kiện ngoài tài liệu.
  - Mỗi câu hỏi phải phân bổ vào một trong 3 mức độ nhận thức: `recognition`, `comprehension`, `application`.
  - Phân bổ cân đối tỷ lệ các dạng câu hỏi được người dùng chọn (`single`, `multiple`, `boolean`, `short`, `fill`).
  - `answerOrigin` luôn là `'ai_suggested'`, `reviewed: false` (yêu cầu giáo viên duyệt).

### 1.2 Trích xuất nguyên văn đề có sẵn (`extract_existing`)
- **Mục đích**: Nhận diện các câu hỏi đã có sẵn trong tài liệu, trích xuất cấu trúc gốc, điền đáp án và lời giải chi tiết.
- **Quy tắc**:
  - Giữ nguyên văn `stem` và `options` gốc từ tài liệu. Không để AI viết lại câu dẫn hay xáo trộn thứ tự phương án.
  - Nếu câu hỏi trong tài liệu đã có đáp án gốc hợp lệ (`documentAnswer`), đối chiếu chặt chẽ:
    * Đáp án AI giải phải khớp với đáp án gốc tài liệu; nếu không khớp, báo lỗi `INVALID_OUTPUT` để yêu cầu kiểm tra lại.
    * Gán `answerOrigin: 'document'`.
    * Kèm trích dẫn trích đoạn đáp án gốc trong `sourceRefs`.
  - Nếu câu hỏi trong tài liệu chưa có đáp án gốc:
    * AI tự giải câu hỏi, cung cấp lời giải đa bước logic.
    * Gán `answerOrigin: 'ai_suggested'`.
    * Tuyệt đối không được gán thành `'document'` khi tài liệu không có đáp án.

### 1.3 Phân tích & Tự động giải (`ai_analyze`)
- **Mục đích**: Tự động phát hiện toàn bộ câu hỏi trong tài liệu, phân loại 4 nhóm câu hỏi, giữ các đáp án đã có và giải các câu chưa có đáp án.
- **Quy tắc**:
  - Đi qua gateway định kiểu, kiểm tra schema và trích dẫn chuẩn hóa.
  - Phân luồng về `extract_existing` với kế hoạch giải các câu chưa có lời giải chi tiết.

---

## 2. Ma Trận Dạng Câu Hỏi & Cấu Trúc Dữ Liệu (4 Nhóm Trọng Tâm)

| Dạng câu hỏi | Code contract | Cấu trúc `options` | Cấu trúc đáp án đúng |
|---|---|---|---|
| **Trắc nghiệm đơn** | `single` | 2-8 phương án (`{ id, text }`) được trích từ nhãn `A. B. C. D.` (dấu chấm) | `correctOptionIds: [id]` (duy nhất 1 ID) |
| **Trắc nghiệm chọn nhiều** | `multiple` | 2-8 phương án (`A. B. C. D.`) | `correctOptionIds: [id1, id2, ...]` ($\ge 2$ IDs) |
| **Đúng / Sai** | `boolean` | Luôn gồm 2 phương án: `['Đúng', 'Sai']` cho từng mệnh đề `a) b) c) d)` (khi câu thuộc phần Đúng–Sai và không có cụm `A. B. C. D.` cuối câu) | `correctOptionIds: [id]` |
| **Trả lời ngắn** | `short` | Mảng rỗng `[]` | `acceptedAnswers: [val1, val2, ...]` (không dùng `options`) |
| **Điền chỗ trống** | `fill` | Mảng rỗng `[]` | `acceptedAnswers: [val1, val2, ...]` (không dùng `options`) |

### Quy tắc Bảo toàn Ý con trong Thân câu hỏi & Chuẩn hóa Công thức STEM (Toán – Lý – Hóa – Sinh)
1. **Phân biệt Nhãn đáp án (`A. B. C. D.`) và Ý con trong câu hỏi (`A) a) b) c) d)`)**:
   - Trong câu hỏi trắc nghiệm (`single` / `multiple`), chỉ các dòng bắt đầu bằng chữ hoa + dấu chấm (`A.`, `B.`, `C.`, `D.`) mới là phương án trả lời (`options`).
   - Mọi ý liệt kê dạng `A)`, `B)`, `C)`, `D)` hoặc `a)`, `b)`, `c)`, `d)` nằm trong đề bài là các ý con của câu hỏi, bắt buộc giữ nguyên trong `stem`, không được tách nhầm thành `options`.
2. **Bắt buộc dùng Phông chữ Công thức (`$LaTeX$` / KaTeX) cho Toán – Lý – Hóa – Sinh**:
   - Khi AI sinh câu hỏi mới (`ai_generate`), trích xuất đề (`extract_existing`) hoặc viết lời giải (`explanation`), **tất cả** biểu thức Toán học, Vật lý, công thức/phương trình Hóa học (`$\text{H}_2\text{SO}_4$`, `$\text{Fe}^{3+}$`, `$\xrightarrow{t^\circ}$`, `$\rightleftharpoons$`, `$\downarrow$`, `$\uparrow$`) và ký hiệu di truyền Sinh học (`$2n = 46$`, `$\text{X}^{\text{A}}\text{X}^{\text{a}}$`, `$\frac{\underline{\text{AB}}}{\text{ab}}$`, `$\text{F}_1$`) **bắt buộc** bọc trong cú pháp LaTeX `$...$` để hiển thị bằng phông chữ công thức KaTeX, tuyệt đối không xuất dạng ký tự văn bản thuần (`H2SO4`, `Fe3+`, `x^2`).

---

## 3. Ma Trận Mức Độ Nhận Thức (Difficulty Distribution)

Phân bổ ma trận đề thi chuẩn:
- **Nhận biết (`recognition`)** (mặc định ~40%): Nhận diện định nghĩa, công thức, sự kiện, thuật ngữ trực tiếp từ văn bản.
- **Thông hiểu (`comprehension`)** (mặc định ~40%): Giải thích nguyên lý, so sánh, phân loại, suy luận logic trực tiếp.
- **Vận dụng (`application`)** (mặc định ~20%): Tính toán, giải bài toán tình huống, áp dụng công thức vào số liệu cụ thể.

Thuật toán phân bổ:
- Sử dụng thuật toán Largest Remainder (Hamilton method) để đảm bảo tổng số câu theo mức độ đúng chính xác 100% `questionCount`.
- Không tạo câu hỏi vượt quá phạm vi kiến thức mà tài liệu cung cấp.

---

## 4. Kiểm Soát Nguồn Gốc Đáp Án (Answer Provenance)

1. **`document`**:
   - Chỉ được gán khi câu hỏi có bằng chứng đáp án thực tế trong tài liệu (bôi màu highlight, shading, gạch chân, đổi màu, in đậm, nhãn `*`, `✓`, `[x]`, dòng `Đáp án: ...`, hoặc bảng đáp án).
   - Bắt buộc có trích dẫn `sourceRefs` chứa trích đoạn câu chữ đáp án gốc (`answer.quote`).
   - Khi question numbers lặp lại giữa các phần (ví dụ Phần I có Câu 1, Phần II có Câu 1), bảng đáp án chỉ được áp dụng trong phạm vi section tương ứng, tránh nhận nhầm câu hỏi giữa các phần.
2. **`ai_suggested`**:
   - Tất cả câu hỏi do AI tạo mới hoặc AI giải bổ sung khi tài liệu không có đáp án.
   - Cấm mọi hành vi biến đáp án AI thành đáp án gốc `document`.
3. **`teacher`**:
   - Khi giáo viên trực tiếp chỉnh sửa, can thiệp hoặc phê duyệt đáp án qua giao diện Editor/Studio.

---

## 5. Trích Dẫn Nguồn Nghiêm Ngặt (`sourceRefs` Grounding)

Mỗi câu hỏi được sinh ra **BẮT BUỘC** phải có danh sách `sourceRefs`:
```typescript
sourceRefs: Array<{
  chunkId: string;    // ID định danh của đoạn tài liệu đã chia
  quote: string;      // Trích đoạn văn bản NGUYÊN VĂN từ chunk đó
}>
```
- **Hàm kiểm tra `assertCitations(questions, chunks)`**:
  - Kiểm tra `chunkId` có tồn tại trong tài liệu không.
  - Kiểm tra chuỗi `quote` có xuất hiện liên tục, nguyên văn trong nội dung của `chunk` đó không.
  - Nếu AI sinh trích dẫn ảo (hallucinated citation) hoặc trích dẫn không có thật -> Bác bỏ toàn bộ nhóm câu hỏi với lỗi `INVALID_OUTPUT`.

---

## 6. Lời Giải Thích Đa Bước Tiêu Chuẩn (Structured Solution)

Mỗi câu hỏi do AI giải hoặc tạo ra phải có cấu trúc giải thích chi tiết:
1. **Kết luận (`conclusion`)**: Khẳng định rõ đáp án đúng ngay câu mở đầu.
2. **Lập luận từng bước (`reasoning`)**: Ít nhất 2 bước cụ thể (Bước 1, Bước 2...).
   - Trắc nghiệm: Nêu rõ vì sao đáp án chọn là đúng, và các phương án còn lại sai ở điểm nào.
   - Đúng/Sai: Nêu căn cứ chứng minh mệnh đề đúng hoặc chỉ ra chỗ sai của mệnh đề.
   - Tính toán / Trả lời ngắn: Nêu công thức, thay số, thực hiện phép tính và đơn vị đo.
3. **Lưu ý / Bẫy thường gặp (`pitfalls`)**: Cảnh báo lỗi sai học sinh hay mắc phải.

---

## 7. An Toàn, Hiệu Năng & Trải Nghiệm Streaming

1. **Batching & Concurrency Limit**:
   - Chia nhỏ tác vụ thành các nhóm (batch) tối đa 3 câu hỏi mỗi lần gọi AI.
   - Chạy đồng thời tối đa 2 nhóm (concurrency = 2) để tránh quá tải gateway và tránh HTTP Gateway Timeout (504).
2. **NDJSON Streaming**:
   - Hỗ trợ endpoint `POST /api/quizzes/generate?stream=1`.
   - Phát các sự kiện thời gian thực theo chuẩn `x-ndjson`:
     * `{"event": "progress", "completed": 3, "total": 10, "stage": "generating"}`
     * `{"event": "result", "questions": [...]}`
     * `{"event": "error", "error": {...}}`
   - Client hiển thị thanh tiến trình trực quan, mượt mà theo Lucian UX/UI.
3. **Bảo mật phòng thi (Active Exam Confidentiality)**:
   - Khi học sinh đang làm bài kiểm tra (`taking` mode):
     * Cấm trả về `correctOptionIds`, `acceptedAnswers`, `explanation`, `sourceRefs` trong JSON/HTML/RSC payload.
     * Thứ tự câu hỏi và phương án được xáo trộn bằng hạt giống ngẫu nhiên (`shuffleSeed`) được quản lý trên server.
     * Server kiểm soát thời gian làm bài và deadline nghiêm ngặt; không tin tưởng thời gian gửi từ trình duyệt client.
4. **Không có chế độ khách (Zero Guest Bypass)**:
   - Mọi thao tác tạo đề, sửa đề, thi thử đều bắt buộc phải có phiên đăng nhập xác thực qua `requireUser()`.
   - Kiểm tra quyền sở hữu (`getOwnedDocument`, `getOwnedQuiz`) tại tầng DAL; không cho phép User A truy cập hoặc tạo đề trên tài liệu của User B.

---

## 8. Danh Mục Điểm Triển Khai & Kiểm Thử

- `apps/web/src/server/generator.ts`: Pipeline sinh câu hỏi bằng AI Gateway, kiểm soát ma trận độ khó, kiểm tra trích dẫn.
- `apps/web/src/app/api/quizzes/generate/route.ts`: Endpoint tạo đề hỗ trợ NDJSON Streaming và kiểm tra quyền tài liệu.
- `apps/web/src/server/quiz-save.ts`: Lưu trữ đề thi với transaction bảo toàn toàn vẹn dữ liệu, chống lưu trùng.
- `apps/web/src/server/dal.ts`: Tầng truy cập dữ liệu, kiểm soát phân quyền và che giấu đáp án phòng thi.
- `apps/web/src/app/api/quizzes/[id]/route.ts`: API quản lý và cấu hình đề thi.
- `tests/generator.test.ts`: 20 bài kiểm thử đơn vị & tích hợp pipeline tạo bài.
- `tests/generation-stream.test.ts`: Kiểm thử streaming NDJSON và bắt lỗi timeout/aborted.
- `tests/generation-cache.test.ts`: Kiểm thử bộ nhớ đệm tạo bài.
