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

## 6. Quy Chuẩn Phân Định Nhãn Đáp Án (`A. B. C. D.`) vs Ý Con Trong Câu Hỏi (`A) a) b) c) d)`)

1. **Phương án trả lời trắc nghiệm (`Answer Options`)**:
   - Chỉ nhận diện các nhãn chữ cái in hoa đi kèm **dấu chấm**: **`A.`, `B.`, `C.`, `D.`** (hoặc có ký hiệu đánh dấu đáp án trực tiếp như `*A.`, `A*.`, `✓ A.`, `[x] A.`).
2. **Các ý liệt kê / mệnh đề con thuộc thân câu hỏi (`Stem Sub-items`)**:
   - Các ký hiệu có **dấu ngoặc đơn** như **`A)`, `B)`, `C)`, `D)`** hoặc chữ thường **`a)`, `b)`, `c)`, `d)`**, **`a.`, `b.`, `c.`, `d.`**, **`(a)`, `(b)`, `(1)`, `(2)`** khi xuất hiện trong câu hỏi trắc nghiệm khách quan là **ý con nằm trong thân câu hỏi (`question_stem`)**, **TUYỆT ĐỐI KHÔNG phải phương án trả lời**.
   - **Ví dụ thực tế**:
     * *"Cho các phát biểu sau: a) ... b) ... c) ... d) ... Số phát biểu đúng là: A. 1  B. 2  C. 3  D. 4"* $\rightarrow$ Toàn bộ `a), b), c), d)` thuộc `stem`; chỉ `A. B. C. D.` là `options`.
     * *"Cho các bước thí nghiệm: A) Bước 1... B) Bước 2... C) Bước 3... D) Bước 4... Thứ tự đúng là: A. A-B-C-D  B. B-A-C-D..."* $\rightarrow$ `A), B), C), D)` thuộc `stem`; chỉ `A., B., C., D.` ở cụm cuối mới là `options`.
3. **Ngoại lệ duy nhất cho Dạng Đúng – Sai (Phần II chuẩn BGD)**:
   - Chỉ khi câu hỏi thuộc **Phần Đúng – Sai (`TRUE_FALSE` / `boolean`)** và **không có cụm phương án `A. B. C. D.` ở cuối câu**, các mệnh đề `a), b), c), d)` mới được bóc tách thành các nhận định Đúng/Sai (`statements`).

---

## 7. Nhận Diện Phông Chữ Công Thức & Bộ Công Cụ Ký Tự Toán – Lý – Hóa – Sinh (STEM Formula & Font Protocol)

> **Quy tắc bắt buộc**: Mọi công thức, ký hiệu, chỉ số trên/dưới của Toán, Vật lý, Hóa học, Sinh học **bắt buộc** phải được nhận diện và hiển thị bằng **phông chữ công thức chuyên dụng (`KaTeX_Math`, `KaTeX_Main`, `mhchem` `\ce{...}`)**, **TUYỆT ĐỐI KHÔNG dùng ký tự văn bản bình thường** (như `H2SO4`, `Fe3+`, `x^2`, chữ `a` thường thay cho $\alpha$).

### 7.1 Nhận diện Phông chữ Công thức từ Tài liệu gốc (DOCX OOXML / PDF / OCR)
Tham khảo kiến trúc từ các dự án mã nguồn mở trên GitHub (`plurimath/plurimath`, `hrushikeshrv/docxlatex`, `mhchem/mhchemParser`, `breezedeus/Pix2Text`):
1. **Word Native Equations & MathType OLE**:
   - Giải mã `<m:oMath>`, `<m:oMathPara>` (OMML) và `w:object` (MathType MTEF binary stream) trực tiếp sang chuỗi LaTeX `$...$`.
2. **Nhận diện Phông chữ Ký hiệu (`<w:rFonts>` & `<w:sym>`)**:
   - Quét các thẻ `<w:sym w:font="Symbol|MT Extra|Euclid..." w:char="..."/>` và các `<w:r>` dùng phông `Symbol`, `MT Extra`, `Euclid Symbol`, `Euclid Extra`, `Euclid Math One`, `Euclid Math Two`, `Cambria Math`.
   - Ánh xạ chính xác bảng mã glyph của phông chữ công thức sang lệnh LaTeX (`\alpha, \beta, \gamma, \Delta, \Omega, \lambda, \mu, \pi, \varphi, \rightleftharpoons, \uparrow, \downarrow, \le, \ge, \ne, \approx, \pm, \times, \div, \infty, \angle, \perp, \parallel`) thay vì để Mammoth xuất ra ký tự ASCII thường bị sai lệch.
3. **Nhận diện Chỉ số Trên / Dưới (`<w:vertAlign>`) & Chữ nghiêng Biến số (`<w:i>`)**:
   - Mọi `<w:r>` có `<w:vertAlign w:val="subscript"/>` hoặc `<w:vertAlign w:val="superscript"/>` (rất phổ biến khi giáo viên gõ công thức Hóa học $\text{H}_2\text{SO}_4$, $\text{Fe}^{3+}$, Sinh học $\text{F}_1, \text{X}^{\text{A}}\text{X}^{\text{a}}$, Vật lý $v_0, t_1$) phải được gom cùng cơ số liền trước và chuyển thành LaTeX `$..._{...}^{...}$` hoặc `$\ce{...}$`.
   - Trong PDF/OCR: Nhận diện chênh lệch baseline và kích thước font của glyph chỉ số trên/dưới để tái tạo đúng `_{...}` và `^{...}`.

### 7.2 Bộ Công Cụ Gõ Ký Tự & Công Thức Toán – Lý – Hóa – Sinh (STEM Visual Input Toolbar)
Tích hợp thanh công cụ nhập công thức trực quan (tham khảo chuẩn `arnog/mathlive` `<math-field>` & `KaTeX mhchem`) trong trình soạn thảo câu hỏi:
- **Tab Toán học (Math)**:
  - Phân số `\tfrac{a}{b}`, `\frac{a}{b}`, căn thức `\sqrt{x}`, `\sqrt[n]{x}`, lũy thừa/chỉ số `x^{n}`, `x_{i}`.
  - Giải tích: `\int_{a}^{b}`, `\sum_{i=1}^{n}`, `\prod`, `\lim_{x \to x_0}`, đạo hàm `f'(x)`, `\frac{dy}{dx}`.
  - Đại số & Tập hợp: Hệ phương trình `\begin{cases} ... \end{cases}`, ma trận, `\in, \notin, \subset, \subseteq, \cup, \cap, \emptyset, \mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{R}, \mathbb{C}`.
  - Hình học & Lượng giác: `\widehat{ABC}`, `\angle A`, `\vec{AB}`, `\perp`, `\parallel`, `\triangle`, `\sin, \cos, \tan, \cot`.
- **Tab Vật lý (Physics)**:
  - Vectơ & Trường: `\vec{v}, \vec{a}, \vec{F}, \vec{p}, \vec{E}, \vec{B}, \vec{M}`.
  - Biến thiên & Dao động: `\Delta t, \Delta x, \Delta l, \Delta \varphi, \omega, \lambda, \varphi, A\cos(\omega t + \varphi)`.
  - Vật lý hạt nhân: Ký hiệu đồng vị `{}^{A}_{Z}\text{X}` (ví dụ `{}^{235}_{92}\text{U}`), tia `\alpha, \beta^+, \beta^-, \gamma`.
  - Đơn vị đo lường chuẩn: `^\circ\text{C}`, `\text{K}`, `\Omega`, `\mu\text{F}`, `\text{m/s}^2`, `\text{rad/s}`, `\text{Hz}`, `\text{eV}`, `\text{MeV}`.
- **Tab Hóa học (Chemistry - `mhchem` `\ce{...}`)**:
  - Phân tử, Ion & Điện tích: `\text{H}_2\text{SO}_4`, `\text{Fe}^{3+}`, `\text{Cu}^{2+}`, `\text{SO}_4^{2-}`, `\text{NO}_3^-`, `\text{NH}_4^+`.
  - Mũi tên phản ứng & Điều kiện: `\longrightarrow`, `\xrightarrow{t^\circ}`, `\xrightarrow{t^\circ, \text{xt}, p}`, `\rightleftharpoons` (thuận nghịch), `\downarrow` (kết tủa), `\uparrow` (bay hơi).
  - Liên kết & Cấu trúc hữu cơ: Liên kết đơn `-`, đôi `=`, ba `\equiv`, nhóm chức `-\text{CHO}`, `-\text{COOH}`, `-\text{OH}`, `-\text{NH}_2`, `-\text{COO}-`, cấu hình electron `1s^2 2s^2 2p^6`.
- **Tab Sinh học (Biology)**:
  - Di truyền học & Phép lai: `\text{P}`, `\text{F}_1`, `\text{F}_2`, `\text{G}`, `\times`, giới tính `\female` ($\female$), `\male` ($\male$).
  - Nhiễm sắc thể & Đột biến: `2n`, `n`, `2n+1` (thể ba), `2n-1` (thể một), `3n`, `4n`.
  - Kiểu gen & Liên kết gen: Alen trội/lặn, gen trên NST giới tính `\text{X}^{\text{A}}\text{X}^{\text{a}}`, `\text{X}^{\text{a}}\text{Y}`, nhóm máu `\text{I}^{\text{A}}\text{I}^{\text{B}}, \text{I}^{\text{O}}\text{I}^{\text{O}}`, kiểu gen liên kết `\frac{\underline{\text{AB}}}{\text{ab}}`.
  - Sinh học phân tử & Chuyển hóa: `5' \to 3'`, `3' \to 5'`, `\text{A}-\text{T}`, `\text{G}-\text{X}`, `\text{ATP}, \text{ADP}, \text{NADH}, \text{FADH}_2`.

### 7.3 Hòa đồng KaTeX Typography & Bố cục lưới phương án
1. **Hòa đồng KaTeX & Typography**:
   - KaTeX inline: kích thước `1.02em`, `vertical-align: -0.06em` khớp phông chữ `Be Vietnam Pro`.
   - Phân số inline ưu tiên `\tfrac`.
   - Mọi biểu thức công thức bắt buộc render qua font `KaTeX_Main` / `KaTeX_Math`, không fallback về sans-serif thường.
2. **Bố cục lưới phương án (Dynamic Option Grid)**:
   - Ngắn ($\le 14$ ký tự): 4 cột (1 dòng).
   - Trung bình ($15 - 35$ ký tự): 2 cột (2 dòng).
   - Dài ($> 35$ ký tự): 1 cột (4 dòng).

---

## 8. Danh Mục Điểm Triển Khai & Kiểm Thử

- `apps/web/src/lib/text-sanitizer.ts`: Khử nhiễu văn bản, bảo toàn `\f` (`\x0C`), bảo vệ dấu nhân toán học `*`.
- `apps/web/src/lib/exam-layout.ts`: Tách ranh giới dính dòng, xếp phương án A–D, nhận diện dạng câu hỏi bottom-up.
- `apps/web/src/server/question-sections.ts`: Phân tích tài liệu, phân đoạn câu hỏi, xử lý phạm vi bảng đáp án section-scoped, phát hiện hình ảnh.
- `apps/web/src/server/docx-preprocessor.ts` & `apps/web/src/server/document-answer-marks.ts`: Trích xuất highlight/underline/color từ OOXML DOCX.
- `apps/web/src/server/extractor.ts`: Bộ bóc tách đa định dạng (PDF, DOCX, TXT, OCR).
- `tests/document-analysis.test.ts`: Kiểm thử bóc tách cấu trúc hỗn hợp, phân trang `\f`.
- `tests/document-answer-marks.test.ts`: Kiểm thử bóc tách dấu vết đáp án OOXML DOCX.
- `tests/exam-question-recognition.test.ts`: Kiểm thử nhận diện câu hỏi, bảng đáp án inline và bôi màu.
