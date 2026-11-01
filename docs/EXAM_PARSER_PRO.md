# Exam-Parser-Pro

Nâng từ yêu cầu bộ quét đề đa môn, không chỉ thêm prompt cho AI. Quy tắc chính đã nối vào parser editor, đọc tài liệu và xuất JSON.

## Quy tắc đã bổ sung

- Xét cụm phương án A–D cuối câu trước tiêu đề và các từ “đúng/sai”, “điền vào”. Bảng ghép nối, a/b và danh sách số ở phía trước được giữ làm ngữ cảnh.
- Tách ranh giới câu, phần và phương án bị dính. Giữ `original_number`; số hiển thị riêng liên tục, không tự đánh lại số gốc.
- Sắp A,C,B,D theo nhãn; không di chuyển đáp án theo vị trí mảng cũ.
- Gợi ý nhãn A bị mất hoặc bốn phương án không nhãn trong đúng phần lựa chọn. Các gợi ý này **cần xác minh**, không được coi là sửa chắc chắn.
- Nhận đúng–sai đơn và bảng có cột ĐÚNG/SAI. Giữ ô rỗng/tab; chưa đánh dấu là unknown, không phải false. Ký hiệu `SAI X` khi có cấu trúc verdict cuối ý được tách khỏi nội dung.
- Tách câu hỏi không đánh số trong phần trả lời ngắn. Nhận tự luận và giữ trong export riêng; chưa mở rộng engine chấm tự luận.
- Câu nguồn không có số giữ `original_number: null`; chỉ cấp `display_number` để hiển thị. Nhãn gốc như `Bài 018` được giữ, không đổi thành một số đã đánh lại.

## Giới hạn an toàn

Không thể đảm bảo chính xác tuyệt đối với mọi file OCR. `D15/0` không đủ bằng chứng để biến thành `D. 15/10`: giữ nguyên và báo cần đối chiếu. Header, công thức, tên file và nội dung đánh dấu không được dùng để tùy ý suy ra đáp án.

Môn/lớp không rõ để `null`. Các cách phục hồi từ plain text không thay thế việc đọc tọa độ PDF, style Word và evidence thật. Tài liệu cũ chưa được tách dòng có thể cần **Đọc lại file gốc** để chunks lưu khớp phần chữ đã sửa; không tự cập nhật database tài liệu cũ.

## Xuất JSON

Trong trang **Tài liệu học tập**, chọn **Exam-Parser-Pro JSON**. API:

```text
GET /api/documents/:id/export?format=exam-pro
```

Chỉ chủ tài liệu đã đăng nhập truy cập. Response là file `.exam-pro.json`, `Cache-Control: private, no-store`. JSON cũ `format=json`, CSV, Markdown vẫn giữ nguyên.

```json
{
  "format": "studyforge.exam-parser-pro.v1",
  "exam_metadata": { "title": "Đề cương", "subject": null, "grade": null, "total_questions": 1 },
  "questions": [{
    "id": "Q1", "original_number": "Câu 18", "display_number": 1,
    "section": "PHẦN III. TRẢ LỜI NGẮN", "type": "SHORT_ANSWER",
    "question_stem": "Giá trị cần tìm là bao nhiêu?", "options": [], "sub_statements": [],
    "correct_answer": null, "answer_source": null, "explanation": "",
    "needs_review": true, "diagnostics": ["Chưa có đáp án trả lời ngắn/điền từ."],
    "source_text": "Câu 18: Giá trị cần tìm là bao nhiêu?"
  }],
  "warnings": ["Đáp án thiếu không được tự bịa trong export xác định."]
}
```

Schema kiểm tra bằng Zod tại `apps/web/src/server/exam-parser-pro.ts`. `MULTIPLE_CHOICE` gồm cả chọn một/nhiều và giữ các phương án 2–8 đã có. ESSAY là nhận diện/giữ nội dung, không tự xuất bản vào quiz engine hiện tại. JSON dùng trường null khi chưa biết thay vì ép điền sai.

## AI bổ sung đáp án và lời giải

Chọn chế độ **Phân tích đề bằng AI** trong luồng tạo đề để gọi gateway typed. Luồng cũ gọi provider `generate` không tồn tại đã được bỏ; dùng cùng pipeline có schema, giới hạn batch, kiểm tra số lượng/dạng và citations.

- Stem và options lấy từ parser, model không được viết lại.
- Đáp án tài liệu xác thực được giữ, không chấp nhận model đổi khóa.
- Đáp án AI giải mới là `ai_suggested`, tương ứng `AI_SOLVED`; luôn `reviewed: false`.
- Export xác định **không gọi AI ngầm**, không phát sinh chi phí hoặc gửi tài liệu đi chỉ để tải JSON.
- GDPT 2018 là phạm vi tham khảo, không phải bảo đảm model luôn đúng; giáo viên phải duyệt kết quả và lời giải trước khi dùng cho học sinh.

Skill nội bộ: `skills/exam-parser-pro/SKILL.md`. Không cần migration, dịch vụ storage hoặc thư viện mới.