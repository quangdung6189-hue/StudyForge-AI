# Trình biên soạn đề thi

## Quy trình

1. Mở **Tạo đề**. Chọn tài liệu đã tải hoặc **Mở trình biên soạn · Không cần tài liệu**.
2. Chọn **Trình biên soạn đề thi**. Đặt tên, thời gian; **Nhập đề** cho phép dán text/chọn TXT hoặc nhập JSON StudyForge. Có thể chọn **Công cụ > Mở đề mẫu ba dạng**.
3. Chọn **Song song**, **Trực quan** hoặc **Văn bản**. Điện thoại dùng từng tab, không ép hai khung nhỏ. Chọn câu trong mục lục để tới vị trí; dùng bộ lọc tìm câu thiếu đáp án hoặc cần xác minh.
4. Sửa nội dung, phương án, đáp án và điểm. Ô nội dung trực quan ghi thay đổi khi rời ô; đáp án lựa chọn cập nhật ngay. **Hoàn tác / Làm lại** dùng cho các thay đổi nội dung.
5. Bản soạn tự lưu sau khi ngừng sửa; `Ctrl/Cmd+S` hoặc **Lưu nháp** lưu ngay. Chỉ báo **Đã lưu** sau khi API xác nhận. URL có `draftId` để mở lại; trang chọn tài liệu có danh sách **Bản soạn gần đây**. Bản nháp được phép chưa đủ đáp án; lỗi lưu giữ nguyên nội dung trên trang.
6. **Kiểm tra & duyệt đề** kiểm tra phía server. Câu thiếu/mâu thuẫn đáp án phải sửa hoặc đối chiếu xác minh; không tự gán A. Giáo viên tiếp tục duyệt từng câu trước khi xuất bản.

Khi đang gõ trong ô nội dung trực quan mà chưa rời ô, trạng thái vẫn là chưa lưu. `Ctrl/Cmd+S` chốt nội dung đang gõ trước khi gửi lên server. Một request lưu cũ hoàn tất trong lúc đang gõ không được đổi nhãn thành “Đã lưu” sai. Nhập JSON có phiên bản sẽ khôi phục cả tên đề và thời gian nếu các giá trị hợp lệ.

## Cú pháp được hỗ trợ

```text
PHẦN I. TRẮC NGHIỆM
Câu 1: [2đ] Hai cộng hai bằng bao nhiêu?
A. 3
*B. 4
C. 5
D. 6
Lời giải: Hai nhóm có hai phần tử được bốn phần tử.

PHẦN II. ĐÚNG – SAI
Câu 1: Xét các nhận định:
a) Hai cộng hai bằng bốn.
b) Hai cộng hai bằng năm.
Đáp án: a - Đ, b - S

PHẦN III. TRẢ LỜI NGẮN
Câu 1: Thủ đô của Việt Nam?
Đáp án: Hà Nội | Ha Noi
```

- Đầu câu nhận `Câu 1.`, `Câu 1:`, `Bài 1.`, `Question 1.`, `1.`. Tiêu đề phần không được tính thành câu.
- MCQ dùng A.–H., 2–8 phương án; cho phép cùng dòng hoặc xuống dòng. Đáp án rõ: `*B.`, `[Đáp án]` sau phương án, hoặc `Đáp án: B`. Nhiều đáp án dùng `Đáp án: A, C` và chọn đúng loại câu.
- Các ý a), b), c), d) là nhóm đúng–sai; **không đánh dấu không có nghĩa là sai**. Mỗi ý phải có Đ/S; tất cả ý sai vẫn là câu đã có đáp án.
- Trả lời ngắn/điền từ dùng `|` cho nhiều cách trả lời. `/` là nội dung bình thường, không tách phân số hoặc đơn vị.
- Hỗ trợ bảng đơn giản cuối đề: `HẾT`, `BẢNG ĐÁP ÁN`, dòng `Câu` + số, dòng `Chọn`/`Đáp án` + khóa tương ứng, phân cách bằng tab/khoảng trắng.
- Nhãn `[type:single|multiple|boolean|short|fill]` và `[2.5đ]` là cú pháp nội bộ StudyForge để đổi dạng/điểm không mất dữ liệu. Chuẩn hóa giữ đúng–sai, điểm, lời giải và cảnh báo.
- Chuẩn hóa không tự sửa ký hiệu đáp án sai; các khối chưa đọc được giữ nguyên. Nếu chỉnh trực quan một câu có lỗi làm thay đổi biểu diễn của nó, dấu `[Cần xác minh]` được giữ để giáo viên giải quyết rõ ràng, không biến lỗi thành đáp án đã xác thực.
- Xuất JSON dùng `format: studyforge.exam.v1`. Đây không phải tuyên bố tương thích toàn bộ định dạng riêng của Azota; không dùng đuôi `.azota` giả.

## Đáp án có màu/định dạng

DOCX được đọc thêm OOXML, kể cả style kế thừa, trước khi mất định dạng thành text. Khi nhận diện rõ, thêm dấu `[Đáp án]` vào văn bản đã đọc và lưu evidence trong metadata riêng tư. Tô màu phải là màu khác nền chữ chủ đạo, phủ phần lớn phương án và nhất quán; gạch chân rõ trên nhãn A./B. có thể được nhận. Màu tiêu đề, tô nền nhấn mạnh, gạch chân một phần hoặc nhiều màu trái nhau không được tự coi là đáp án.

Định dạng màu/underline trong một đoạn chứa nhiều phương án cùng dòng chưa có ánh xạ từng span đáng tin: hệ thống đưa vào xác minh, không tự gắn dấu ở cuối đoạn vì có thể chọn nhầm phương án. Theme color chưa phân giải, phối hợp nhiều cách đánh dấu và các dấu không ánh xạ được về đúng dòng cũng không được tự coi là chắc chắn.

Các mục không chắc thêm `[Cần xác minh]` và chặn chuyển duyệt. Giáo viên xem bản gốc, chọn đáp án rồi dùng **Tôi đã đối chiếu, xác minh câu này**. Tài liệu cũ đã chuyển chữ thuần cần **Đọc lại file gốc** để nhận metadata mới; không tự đổi dữ liệu tài liệu đang có.

PDF text hiện không cung cấp màu qua `getText()`. Nhận key văn bản/tables khi rõ; các quy ước màu cần OCR/đối chiếu trang. Không cam kết nhận màu/vector/ảnh scan 100%; OCR có thể thất bại hoặc không rõ, giữ cảnh báo thay vì đoán.

## Lưu dữ liệu, bảo mật và tương thích

- Dùng các bảng Document/DocumentFile/DocumentChunk hiện có, không cần migration mới. Nháp `editor:` và bản nguồn `editor-source:` không hiện như tài liệu upload thường.
- Revision được kiểm tra phía server. Hai tab sửa khác nhau không được âm thầm ghi đè. Retry cùng nội dung xử lý theo tính chất idempotent.
- Chuẩn bị đề tạo bản nguồn có revision bất biến; sửa nháp sau đó không phá trích dẫn của đề đã lưu.
- Mỗi nhóm đúng–sai giữ một câu gốc trong editor, chuyển thành từng mục chấm có hai lựa chọn Đúng/Sai để tương thích engine hiện có. Tổng điểm câu được chia đều cho các ý; chưa thay chính sách chấm thành thang lũy tiến riêng của Bộ GD&ĐT.
- Đáp án nhập tài liệu và đáp án giáo viên/AI được phân biệt. Không tự đánh dấu reviewed. API legacy `/api/code-exam` dùng chung parser, chỉ tạo bản nháp hợp lệ; không xuất bản tắt bước duyệt.
- Tất cả route yêu cầu phiên đăng nhập, truy vấn theo chủ sở hữu. Payload học sinh đang thi tiếp tục dùng allowlist, không có đáp án/lời giải.

## Kiểm tra

```shell
npm run typecheck
npm test -- --maxWorkers=2 --hookTimeout=60000
npm run build
```

Skill nội bộ tại `skills/exam-document-reader/SKILL.md` mô tả quy trình và bộ ca kiểm thử cho agent, không phải dịch vụ đọc file runtime. Không gửi tài liệu riêng lên demo công khai.

Nguồn đối chiếu: [Azota MCQ](https://docs.azota.vn/docs/huong-dan-su-dung/de-thi/tao-de-trac-nghiem-nhieu-phuong-an/), [đúng–sai](https://docs.azota.vn/docs/huong-dan-su-dung/de-thi/tao-de-cau-hoi-dung-sai/), [trả lời ngắn](https://docs.azota.vn/docs/huong-dan-su-dung/de-thi/tao-de-co-cau-tra-loi-ngan/).