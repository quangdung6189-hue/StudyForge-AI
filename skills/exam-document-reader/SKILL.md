---
name: exam-document-reader
description: Develop and verify StudyForge exam import, multi-format document reading, and structured editing for Vietnamese PDF, DOCX, TXT and scanned exams. Use when changing question segmentation, marked answer extraction, code/visual synchronization, answer provenance or exam import regression tests.
---

# Exam Document Reader Protocol — Bộ Chuẩn Đọc Tài Liệu Đề Thi

## Vai trò và phạm vi

Hướng dẫn chi tiết toàn bộ quy trình đọc, bóc tách và chuẩn hóa tài liệu đề thi tiếng Việt đa định dạng (PDF, DOCX, TXT, tài liệu scan OCR, công thức LaTeX).
Phối hợp đồng bộ với:
- `skills/exam-parser-pro/SKILL.md`: Chuẩn phân loại 4 nhóm câu hỏi (Bottom-Up), sửa lỗi dính ranh giới và chuẩn hóa JSON.
- `skills/exam-quiz-generator/SKILL.md`: Quy trình tạo bài kiểm tra, kiểm soát ma trận độ khó, trích dẫn `sourceRefs` và bảo mật đề thi.

Quy tắc bất biến: **Tuyệt đối không tự bịa đáp án, không bỏ rơi phần tự luận, không tự ý sửa số thứ tự câu hỏi và không làm mất dấu tiếng Việt hay công thức toán học.**

---

## 1. Bóc Tách Đa Định Dạng Tài Liệu (Multi-Format Document Ingestion)

### 1.1 DOCX (Microsoft Word)
- Bóc tách văn bản qua Mammoth HTML kết hợp phân tích trực tiếp file XML cấu trúc (`word/document.xml`, `word/styles.xml`).
- **Bảo toàn bằng chứng định dạng đáp án**:
  - **Highlight / Shading**: Nhận diện thẻ `<w:highlight>` (yellow, green, cyan...) hoặc `<w:shd w:fill="HEX">` trên run hoặc paragraph. Nếu nhãn phương án hoặc toàn bộ phương án có màu highlight nhất quán không mâu thuẫn -> `confidence: 'clear'`, `answerMethod: 'highlight'`.
  - **Underline**: `<w:u>` gạch chân nhãn (`A.`) hoặc toàn bộ phương án (>80% ký tự) -> `confidence: 'clear'`, `answerMethod: 'underline'`.
  - **Contrasting Color**: `<w:color>` khác màu nền tài liệu một cách nhất quán (>80% ký tự phương án) -> `confidence: 'clear'`, `answerMethod: 'color'`.
  - **Bold**: In đậm đặc trưng trên nhãn hoặc phương án.
  - Xung đột nhiều kiểu đánh dấu trong cùng câu -> hạ mức về `confidence: 'verify'` (`[Cần xác minh]`).
- **Hình ảnh trong DOCX**:
  - Khi gặp thẻ `<img>` trong HTML từ Mammoth: chèn placeholder `[Hình N]` hoặc `[Hình N: alt text]` vào đúng vị trí nội dòng trong text; track `imageCount`.

### 1.2 PDF (Portable Document Format)
- Ưu tiên bóc tách native text theo luồng ký tự thực tế.
- **Bảo toàn phân trang (`\f` Form Feed)**:
  - Form feed `\f` (`\x0C`) là ký tự chuẩn phân tách giữa các trang tài liệu.
  - Trong quá trình khử nhiễu/làm sạch văn bản (`sanitizeExamText`), **BẮT BUỘC giữ nguyên `\f` (`\x0C`)**, không được xóa nhầm cùng các mã điều khiển ASCII khác.
  - Phân trang đúng giúp gán chính xác thuộc tính `pageNumber` cho từng câu hỏi để phục vụ việc đối chiếu bản gốc.
- Đối với PDF scan hoặc vùng không thể trích xuất văn bản: chuyển sang OCR fallback có giới hạn thời gian và kích thước, cảnh báo vùng nhận dạng khó.

### 1.3 TXT & Plain Text
- Xử lý chuẩn Unicode NFC, bảo vệ các dấu ngắt dòng có ý nghĩa cấu trúc.
- Bảo vệ dấu nhân toán học `*` (ví dụ `2 * 3` hay `a * b`): phân biệt với dấu sao đánh dấu đáp án `*A.` hay `A*.`.
- Chuẩn hóa khoảng trắng đặc biệt (NBSP, em space) về dấu cách chuẩn.

---

## 2. Bốn Phân Loại Câu Hỏi Cốt Lõi (Core Question Categories)

1. **Trắc nghiệm một đáp án đúng (Single Choice - `single` / `MULTIPLE_CHOICE`)**:
   - 2 đến 8 phương án độc lập A, B, C, D...
   - Chỉ chọn duy nhất 1 đáp án đúng.
   - Nhận diện qua nhãn liên tục A–D, tiêu đề trắc nghiệm khách quan hoặc câu hỏi lựa chọn đơn.

2. **Trắc nghiệm chọn nhiều ý đúng (Multiple Select - `multiple` / `MULTIPLE_SELECT`)**:
   - Phương án A, B, C, D... nhưng có từ 2 đáp án đúng trở lên, hoặc câu lệnh yêu cầu chọn nhiều.
   - Dấu hiệu nhận biết trong stem/tiêu đề: "chọn các phát biểu đúng", "những đáp án đúng là", "các mệnh đề đúng gồm", "có thể chọn nhiều hơn một đáp án", "chọn tất cả các", "nhiều đáp án đúng".
   - Cờ checkbox `[x]` hoặc nhiều phương án được tô màu/gạch chân đồng thời.

3. **Đúng – Sai (True / False - `boolean` / `TRUE_FALSE`)**:
   - Câu hỏi có các nhận định / ý con độc lập: a), b), c), d) (hoặc 1, 2, 3, 4 trong bảng đúng sai).
   - Thí sinh đánh giá từng nhận định là Đúng (Đ/True) hoặc Sai (S/False).
   - Ý chưa có đáp án là `null` (unknown), tuyệt đối không tự gán mặc định là Sai.
   - Nhận diện qua bảng có 2 cột ĐÚNG / SAI hoặc dòng đáp án `a - Đ, b - S, c - Đ, d - S`.

4. **Trả lời điền chỗ trống & Trả lời ngắn (Fill in the Blank & Short Answer - `fill` / `FILL_IN_BLANK` & `short` / `SHORT_ANSWER`)**:
   - **Điền chỗ trống (`fill`)**: Stem chứa ký hiệu chỗ trống cần điền như `_____`, `.....`, `[...]`, `(...)`, `\u2026`, `{...}` hoặc lệnh "Điền vào chỗ trống", "Điền từ/cụm từ còn thiếu".
   - **Trả lời ngắn (`short`)**: Thường nằm ở PHẦN III đề thi chuẩn BGD 2025; câu hỏi kết thúc dấu hỏi `?`, yêu cầu tính toán ra một con số, giá trị, thuật ngữ, tên gọi ("bằng bao nhiêu", "giá trị của m là", "gồm mấy phần"). Không có nhãn A–D, thí sinh tự nhập kết quả.

5. **Tự luận (`unsupported` / `essay`)**:
   - Các câu hỏi yêu cầu giải thích nguyên nhân, trình bày biện pháp, phân tích, chứng minh.
   - Giữ nguyên trong danh sách unsupported/cần duyệt, không ép thành câu trả lời ngắn.

---

## 3. Nhận Diện Trạng Thái Có Đáp Án vs Chưa Có Đáp Án

- **Có đáp án (`hasAnswer = true`)**:
  - Khi có ít nhất một bằng chứng hợp lệ: highlight, underline, font color, bold, ký tự `*A`, `✓`, `[x]`, dòng `Đáp án: ...`, hoặc bảng đáp án.
  - Gán `correct_answer`, `hasAnswer = true`, `answerOrigin: 'document'`.
- **Không có đáp án (`hasAnswer = false`)**:
  - Khi câu hỏi hoàn toàn không có dấu hiệu đánh dấu nào:
    * Giữ nguyên `hasAnswer = false`, `correct_answer = null`, `answer_source = null`.
    * Đưa cảnh báo `MISSING_ANSWER` ("Câu hỏi chưa có đáp án").
    * Đặt `needs_review = true`.
    * **Tuyệt đối không tự đoán mò, không mặc định chọn A, không gán False cho các ý đúng/sai**.

---

## 4. Khớp Bảng Đáp Án Theo Phạm Vi Phần (Section-Scoped Answer Table Mapping)

Khi đề thi có cấu trúc nhiều phần và số thứ tự câu hỏi lặp lại theo từng phần (ví dụ Phần I có Câu 1, Phần II có Câu 1, Phần III có Câu 1):
1. **Kiểm tra tính duy nhất của số câu (`isNumberUnique`)**:
   - Nếu số câu là duy nhất trong toàn bài (ví dụ đề thi đánh số liên tục từ Câu 1 đến Câu 50 không lặp): bảng đáp án chung cuối bài (`answerTables.get('')`) có thể áp dụng an toàn.
   - Nếu số câu bị lặp lại giữa các phần (ví dụ `numberCounts.get('1') > 1`):
     * Bảng đáp án chỉ được áp dụng trong đúng phạm vi `block.section` của phần đó.
     * Cấm dùng bảng đáp án chung hoặc bảng đáp án của phần khác để gán cho câu hỏi trùng số, tránh nhận nhầm câu hỏi giữa các phần.
2. **Cảnh báo mâu thuẫn**:
   - Nếu dấu tại phương án và dòng/bảng đáp án mâu thuẫn -> hủy đáp án tự động, đưa vào `warnings: ['Dấu tại phương án và dòng/bảng đáp án mâu thuẫn; cần xác minh.']`.

---

## 5. Câu Hỏi Có Hình Ảnh Mô Phỏng (Image-Based Questions)

- **Nhận diện placeholder**: `[Hình ...]`, `[Sơ đồ ...]`, `[Biểu đồ ...]`, `[Đồ thị ...]`, `(Hình N)`, `Figure X`.
- **Dữ liệu đầu ra**:
  - `hasImage: boolean`: Xác định câu hỏi có phụ thuộc hình ảnh.
  - `imageRefs: ImageRef[]`: Danh sách hình ảnh gồm `{ id, position, placeholder, description }`.
- **Chẩn đoán cảnh báo**: Thêm `IMAGE_REFERENCE` khi câu hỏi tham chiếu hình nhưng chưa có mô tả nội dung.
- `hasImage` không làm thay đổi phân loại dạng câu hỏi (câu trắc nghiệm có hình vẫn là `single`/`multiple`).

---

## 6. Quy Chuẩn Toán - Lý & Bố Cục Lưới Phương Án

1. **Hòa đồng KaTeX & Typography**:
   - KaTeX inline: kích thước `1.02em`, `vertical-align: -0.06em` khớp phông chữ `Be Vietnam Pro`.
   - Phân số inline ưu tiên `\tfrac`.
   - Chuẩn hóa ký hiệu: `\vec{v}`, `^\circ\text{C}`, `\Omega`, `\Delta t`, `\angle A`.
2. **Bố cục lưới phương án (Dynamic Option Grid)**:
   - Ngắn ($\le 14$ ký tự): 4 cột (1 dòng).
   - Trung bình ($15 - 35$ ký tự): 2 cột (2 dòng).
   - Dài ($> 35$ ký tự): 1 cột (4 dòng).

---

## 7. Danh Mục Điểm Triển Khai & Kiểm Thử

- `apps/web/src/lib/text-sanitizer.ts`: Khử nhiễu văn bản, bảo toàn `\f` (`\x0C`), bảo vệ dấu nhân toán học `*`.
- `apps/web/src/lib/exam-layout.ts`: Tách ranh giới dính dòng, xếp phương án A–D, nhận diện dạng câu hỏi bottom-up.
- `apps/web/src/server/question-sections.ts`: Phân tích tài liệu, phân đoạn câu hỏi, xử lý phạm vi bảng đáp án section-scoped, phát hiện hình ảnh.
- `apps/web/src/server/docx-preprocessor.ts` & `apps/web/src/server/document-answer-marks.ts`: Trích xuất highlight/underline/color từ OOXML DOCX.
- `apps/web/src/server/extractor.ts`: Bộ bóc tách đa định dạng (PDF, DOCX, TXT, OCR).
- `tests/document-analysis.test.ts`: Kiểm thử bóc tách cấu trúc hỗn hợp, phân trang `\f`.
- `tests/document-answer-marks.test.ts`: Kiểm thử bóc tách dấu vết đáp án OOXML DOCX.
- `tests/exam-question-recognition.test.ts`: Kiểm thử nhận diện câu hỏi, bảng đáp án inline và bôi màu.
