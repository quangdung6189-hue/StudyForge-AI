Revision `4fe8aa965afa3ed4d8668ee1cced7a002b055c85` **chưa đủ điều kiện nghiệm thu hoặc triển khai production**. Review phát hiện **13 High, 7 Medium, 1 Low**.

Đã đọc toàn bộ mã ứng dụng, 14 file route API, các package, schema DB, cấu hình, PRD, ARCHITECTURE, API_CONTRACTS, AGENTS và báo cáo/test hiện có. Không sửa file. Working tree giữ nguyên file chưa được track `team/prompts/90-final-review.md` đã có từ đầu.

Các bước Reproduction dưới đây dùng để kiểm tra lại. Những kiểm tra thực sự đã chạy được liệt kê riêng; probe dùng DB giả trong bộ nhớ không thay thế kiểm thử với DB thật.

**F01 — Severity: High — Có thể vượt kiểm tra mã tham gia bằng bộ lọc Prisma**

- **File & dòng:** [start/route.ts:9](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/attempts/start/route.ts:9>), [dal.ts:265](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:265>).
- **Reproduction:** Đăng nhập, gửi `POST /api/attempts/start` với `{"shareCode":{"not":null}}`. Request không qua `AttemptStartSchema`; object đi thẳng vào `where.shareCode`.
- **Impact:** Truy vấn chọn đề đã phát hành có mã bất kỳ, không yêu cầu người dùng biết mã chia sẻ. Đây là lỗi kiểm soát quyền truy cập.
- **Remediation:** Validate request bằng schema trước khi gọi DAL; DAL chỉ nhận chuỗi hợp lệ. Với luồng `quizId`, thực thi policy owner/membership tương ứng.

**F02 — Severity: High — Nộp đáp án mới sau deadline vẫn được chấm**

- **File & dòng:** [dal.ts:376](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:376>).
- **Reproduction:** Bắt đầu lượt thi, chờ qua `expiresAt`, rồi gửi đáp án đúng vào endpoint submit.
- **Impact:** `submitQuizAttempt` không kiểm tra thời hạn trước khi merge và chấm đáp án. Probe trong bộ nhớ xác nhận đáp án gửi sau hạn vẫn đạt điểm tối đa.
- **Remediation:** Kiểm tra thời gian trong transaction. Khi hết hạn, chỉ được hoàn tất bằng đáp án đã lưu hợp lệ trước hạn; không nhận thay đổi mới từ request.

**F03 — Severity: High — Bỏ qua xác minh email; thiếu luồng reset mật khẩu**

- **File & dòng:** [register/route.ts:29](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/auth/register/route.ts:29>), [login/route.ts:35](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/auth/login/route.ts:35>), [contracts:15](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/packages/contracts/src/index.ts:15>).
- **Reproduction:** Đăng ký email không thuộc quyền sở hữu của người đăng ký. Backend tự đặt `emailVerifiedAt` và cấp session ngay, kể cả production. Không có route triển khai verify-email, forgot-password hoặc reset-password.
- **Impact:** Không chứng minh quyền sở hữu email; người dùng không thể khôi phục mật khẩu theo PRD. Các token/schema hiện có chưa tạo thành luồng hoạt động.
- **Remediation:** Triển khai token có hạn, dùng một lần, gửi email thật; không cấp quyền sản phẩm trước xác minh. Reset mật khẩu phải tiêu thụ token nguyên tử và thu hồi session theo policy.

**F04 — Severity: High — Đáp án đề mẫu nằm trong mã client của trang Study**

- **File & dòng:** [study/page.tsx:10](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/study/page.tsx:10>), [seed.ts:149](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/packages/db/seed.ts:149>).
- **Reproduction:** Trước khi nộp đề Sinh học mẫu, mở `/study` và lật thẻ. Hoặc đọc chunk JavaScript của trang Study.
- **Impact:** Đáp án và giải thích trùng nội dung đề mẫu được nhúng vào client, không phụ thuộc trạng thái lượt thi hay policy review. Artifact `.next` hiện có cũng chứa các chuỗi này. Đồng thời, “luyện lại câu sai” chỉ dùng hai thẻ cố định, không đọc kết quả người dùng.
- **Remediation:** Thay dữ liệu cố định bằng API lấy câu sai có kiểm tra owner và thời điểm được xem. Tách dữ liệu demo khỏi luồng sản phẩm.

**F05 — Severity: High — Thiếu rate limit và giới hạn tài nguyên cho auth/AI**

- **File & dòng:** [login/route.ts:6](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/auth/login/route.ts:6>), [generate/route.ts:22](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/quizzes/generate/route.ts:22>), [generator.ts:66](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/generator.ts:66>).
- **Reproduction:** Gọi login/generate liên tục. Khi gateway thiếu cấu hình hoặc lỗi, gửi `questionCount: "Infinity"` với document hợp lệ; `Number()` tạo `Infinity`, được dùng làm giới hạn vòng lặp fallback.
- **Impact:** Brute force, tăng chi phí AI, cạn CPU/RAM. `RateLimitBucket` và các biến hạn mức chỉ được khai báo, chưa được sử dụng.
- **Remediation:** Áp dụng schema giới hạn số lượng, rate limit lưu tập trung, giới hạn đồng thời và ngân sách AI. Không chạy vòng lặp nguy hiểm để kiểm thử lỗi này.

**F06 — Severity: High — Upload không kiểm tra loại file, dung lượng hoặc số lượng**

- **File & dòng:** [upload/route.ts:15](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/documents/upload/route.ts:15>).
- **Reproduction:** Gửi multipart chứa file vượt hạn cấu hình, nhiều file, file rỗng hoặc nội dung không khớp MIME/extension.
- **Impact:** Toàn bộ file được đọc vào RAM và ghi storage trước validation. Không có giới hạn giải nén DOCX, thời gian parser hoặc dọn file khi parse/DB thất bại.
- **Remediation:** Thực thi giới hạn request/file/count, kiểm tra signature và kiểu được hỗ trợ, đặt giới hạn parser/decompression, dọn file khi thất bại. Dùng `PRIVATE_STORAGE_DIR` thay đường dẫn hardcode.

**F07 — Severity: High — Parser PDF gọi sai API; ảnh/scan bị báo hoàn tất giả**

- **File & dòng:** [extractor.ts:19](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/extractor.ts:19>), [upload/route.ts:38](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/documents/upload/route.ts:38>).
- **Reproduction:** Upload PDF với dependency `pdf-parse@2.4.5`. Code gọi module như hàm v1, trong khi bản cài đặt cung cấp `PDFParse`. Upload PNG hoặc file rỗng cũng trả text nhị phân/placeholder.
- **Impact:** PDF rơi vào nhánh đọc bytes như UTF-8; ảnh không được OCR nhưng document vẫn mang trạng thái `ready`. Quiz có thể được tạo từ nội dung rác.
- **Remediation:** Dùng `new PDFParse({ data }).getText()` và giải phóng parser. Trả `needs_ocr`/`failed` đúng thực tế; chỉ chuyển `ready` sau khi trích xuất thành công.

**F08 — Severity: High — Có thể publish câu hỏi sai cấu trúc, thiếu căn cứ và chưa duyệt**

- **File & dòng:** [quizzes/route.ts:41](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/quizzes/route.ts:41>), [dal.ts:201](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:201>), [publish/route.ts:11](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/quizzes/[id]/publish/route.ts:11>).
- **Reproduction:** Tạo quiz với `points: -5`, `sourceRefs: []`, đáp án không thuộc options hoặc `reviewed: false`, rồi publish. Gửi `allowReview: "false"` cũng bị đổi thành `true`.
- **Impact:** Schema đã có nhưng không được áp dụng. Không gọi `assertCitations`; có thể chấm sai và công bố lời giải trái ý định cấu hình.
- **Remediation:** Validate create/publish tại backend; kiểm tra nguồn thuộc document và quote khớp; kiểm soát `answerOrigin`/trạng thái duyệt; từ chối giá trị boolean sai kiểu. Bổ sung DB constraints phù hợp.

**F09 — Severity: High — Gateway lỗi bị che bằng câu hỏi giả, kể cả chế độ giữ đề gốc**

- **File & dòng:** [generator.ts:49](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/generator.ts:49>).
- **Reproduction:** Tắt gateway, chọn `extract_existing` và yêu cầu `multiple`. Backend vẫn trả thành công với câu mới dạng `single`.
- **Impact:** Mất cấu trúc/câu hỏi/đáp án gốc, che lỗi cấu hình và lỗi upstream. Probe đã xác nhận hành vi này. `difficultyDistribution` cũng chưa được sử dụng.
- **Remediation:** Trả lỗi/trạng thái xử lý thật. Nếu có demo fallback, phải tách và ghi rõ; không dùng để đáp ứng chế độ giữ đề gốc. Validate kết quả theo cấu hình và thực hiện bước review đã đặc tả.

**F10 — Severity: High — Autosave có thể làm hỏng lượt thi và ghi sau khi đã nộp**

- **File & dòng:** [dal.ts:344](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:344>).
- **Reproduction:** Lưu `{"answers":{"not-a-question":["bogus"]}}`, sau đó submit; decoder ném `Unknown question`. Hoặc cho save kiểm tra trạng thái trước, submit hoàn tất, rồi để save tiếp tục ghi.
- **Impact:** Một payload sai có thể khiến lượt thi không nộp được. Save ngoài transaction còn có thể trả “saved” sau khi bài đã chấm, tạo bất nhất giữa dữ liệu và điểm.
- **Remediation:** Validate toàn bộ đáp án theo snapshot trước khi lưu; đặt save trong cơ chế transaction/khóa thống nhất với submit; cập nhật có điều kiện theo trạng thái và deadline. Hai trường hợp đều đã được tái hiện bằng probe trong bộ nhớ.

**F11 — Severity: High — Tự nộp khi hết giờ có thể bỏ đáp án mới nhất**

- **File & dòng:** [take/page.tsx:55](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/take/page.tsx:55>).
- **Reproduction:** Chọn hoặc đổi đáp án trong 1,5 giây cuối trước khi timer tự nộp.
- **Impact:** Effect timer giữ `handleSubmit`/`answers` từ lúc bắt đầu attempt. Autosave mới nhất có thể chưa chạy và bị cleanup khi nhận result, khiến đáp án cuối không được chấm.
- **Remediation:** Đọc answers mới nhất qua ref/callback phù hợp; không gọi side effect trong state updater; phối hợp flush autosave và submit. Tính countdown từ `expiresAt` thay vì chỉ trừ từng giây.

**F12 — Severity: High — Lệnh migrate production không có migration để triển khai**

- **File & dòng:** [db.mjs:29](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/scripts/db.mjs:29>), [schema.prisma:1](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/packages/db/prisma/schema.prisma:1>).
- **Reproduction:** Trỏ tới PostgreSQL mới và chạy `db:migrate`. Repository không có thư mục/file migration; lệnh chỉ gọi `prisma migrate deploy`.
- **Impact:** Không có lịch sử tạo/nâng cấp schema tái lập được. Chạy được SQLite bằng `db push` không chứng minh deploy PostgreSQL hoạt động.
- **Remediation:** Commit initial migration và migration nâng cấp; có baseline cho DB đã tồn tại. Kiểm tra DB mới và upgrade giữ dữ liệu, không dùng reset production.

**F13 — Severity: High — Seed xóa dữ liệu và tạo tài khoản có mật khẩu công khai**

- **File & dòng:** [seed.ts:7](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/packages/db/seed.ts:7>), [page.tsx:186](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/page.tsx:186>).
- **Reproduction:** Chạy `db:seed` với DB đã có dữ liệu, hoặc triển khai DB đã seed rồi mở landing page.
- **Impact:** Seed xóa dữ liệu toàn hệ thống, sau đó tạo tài khoản teacher/student có mật khẩu hiển thị công khai. Nếu dùng trên môi trường chia sẻ, mọi người có thể truy cập cùng tài khoản teacher.
- **Remediation:** Tách seed demo chỉ dành cho môi trường demo; chặn production; seed thông thường phải bảo toàn dữ liệu. Loại bỏ thông tin đăng nhập công khai khỏi bản triển khai sản phẩm.

**F14 — Severity: Medium — Refresh/retry không phục hồi đầy đủ attempt và kết quả**

- **File & dòng:** [dal.ts:301](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:301>), [dal.ts:387](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:387>), [take/page.tsx:40](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/take/page.tsx:40>).
- **Reproduction:** Autosave rồi refresh. Hoặc submit thành công nhưng mất response và retry.
- **Impact:** Resume không trả đáp án đã lưu; UI bỏ qua `isSubmitted`. Retry giữ điểm nhưng bỏ `details`, dù policy cho xem; không có API lấy lại kết quả.
- **Remediation:** Trả trạng thái/đáp án đã lưu khi resume; cung cấp API kết quả có kiểm tra owner; retry phải trả kết quả đã lưu theo cùng policy. Probe đã xác nhận thiếu answers và details.

**F15 — Severity: Medium — Sửa văn bản tài liệu không cập nhật chunks**

- **File & dòng:** [dal.ts:91](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:91>), [generate/route.ts:20](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/quizzes/generate/route.ts:20>).
- **Reproduction:** Sửa một kiến thức trong trình soạn thảo, lưu rồi tạo quiz.
- **Impact:** `rawText` và revision thay đổi, nhưng generator vẫn đọc chunks cũ. Người dùng nhận câu hỏi/citation từ nội dung chưa sửa.
- **Remediation:** Rechunk nguyên tử theo revision; generation phải dùng đúng revision. Giữ nguồn lịch sử cần thiết cho quiz đã publish.

**F16 — Severity: Medium — Nhập tay mã thi thông thường không hoạt động**

- **File & dòng:** [take/page.tsx:182](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/take/page.tsx:182>), [dal.ts:205](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/server/dal.ts:205>).
- **Reproduction:** Publish quiz mới rồi nhập/paste mã vào ô tham gia.
- **Impact:** Backend sinh hex chữ thường; UI chuyển thành chữ hoa; truy vấn so sánh mã nguyên trạng. Mã demo chữ hoa che khuất lỗi này.
- **Remediation:** Quy định một dạng mã chuẩn và chuẩn hóa thống nhất ở cả tạo, nhập và truy vấn.

**F17 — Severity: Medium — Không thể trả lời câu fill/short trên UI**

- **File & dòng:** [take/page.tsx:491](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/take/page.tsx:491>).
- **Reproduction:** Tham gia đề có câu `fill` hoặc `short`.
- **Impact:** UI chỉ render options; câu văn bản có `options: []` nên không có control nhập đáp án.
- **Remediation:** Render input/textarea có nhãn theo loại câu; nối với answers, autosave và submit.

**F18 — Severity: Medium — Bước “Duyệt & Sửa” chưa có chức năng sửa**

- **File & dòng:** [create/page.tsx:379](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/create/page.tsx:379>), [quizzes/[id]/route.ts:5](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/api/quizzes/[id]/route.ts:5>).
- **Reproduction:** Sinh câu hỏi có đáp án sai rồi thử sửa stem, đáp án, citation hoặc điểm trước publish.
- **Impact:** Chỉ có nội dung hiển thị và nút publish; không có editor, thao tác duyệt hay API cập nhật quiz. Người dùng không hoàn thành được luồng kiểm chứng theo PRD.
- **Remediation:** Triển khai editor và API cập nhật có ownership/validation; lưu trạng thái duyệt trước khi tạo version.

**F19 — Severity: Medium — Chưa đạt các yêu cầu accessibility cơ bản**

- **File & dòng:** [documents/page.tsx:202](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/documents/page.tsx:202>), [take/page.tsx:591](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/take/page.tsx:591>), [LucianSignIn.tsx:246](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/components/lucian/LucianSignIn.tsx:246>), [globals.css:13](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/globals.css:13>).
- **Reproduction:** Chỉ dùng bàn phím để chọn tài liệu/câu trong palette; kiểm tra tên control bằng screen reader; đo màu text phụ và nút xanh.
- **Impact:** Các `div onClick` không thao tác được bằng bàn phím; label chưa liên kết với control; lựa chọn đáp án thiếu trạng thái semantic. Hai cặp màu đã đo đạt khoảng **2,54:1**, dưới mức 4,5:1 cho text thường. Đối chiếu [Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html), [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Remediation:** Dùng button/radio/checkbox native, liên kết label, công bố trạng thái/lỗi và điều chỉnh token màu. Chạy kiểm tra keyboard, screen reader và axe.

**F20 — Severity: Medium — Màn publish có nguy cơ tràn ngang ở 375px**

- **File & dòng:** [create/page.tsx:472](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/app/(workspace)/quizzes/create/page.tsx:472>).
- **Reproduction:** Publish quiz mới có mã hex 32 ký tự và mở bước 4 ở viewport 375px.
- **Impact:** Mã dùng font 32px, letter-spacing 4px trong `inline-flex` có padding lớn, thiếu ràng buộc co/đổi dòng phù hợp. Ràng buộc CSS không đáp ứng chiều rộng màn hình nhỏ; chưa đo trực tiếp bằng browser trong lượt này.
- **Remediation:** Giới hạn chiều rộng, cho mã ngắt dòng hoặc giảm cỡ chữ; bổ sung hành động copy. Kiểm tra với mã thực tế và nội dung dài ở 375px.

**F21 — Severity: Low — Timer upload không được cleanup khi lỗi mạng**

- **File & dòng:** [LucianUpload.tsx:62](<C:/Users/DANG QUANG DUNG/Downloads/Website tools bài ktra/apps/web/src/components/lucian/LucianUpload.tsx:62>).
- **Reproduction:** Bắt đầu upload rồi làm `fetch` reject hoặc rời trang khi request đang chờ.
- **Impact:** `clearInterval` chỉ chạy sau khi fetch resolve; lỗi mạng để timer tiếp tục chạy, cập nhật state định kỳ.
- **Remediation:** Dọn timer trong `finally` và khi unmount; hủy request bằng `AbortController`.

**Các check đã chạy**

- Xác nhận HEAD, inventory, lịch sử commit, tracked diff và trạng thái working tree trước/sau review.
- Typecheck root và web bằng `tsc --noEmit --incremental false`: **pass cả hai**.
- Chạy 5 test nguồn trong `tests/core.test.ts` bằng harness trong bộ nhớ: **5/5 pass**.
- Probe trong bộ nhớ xác nhận: truyền filter Prisma từ request; chấm đáp án sau hạn; autosave chứa ID sai; race save/submit; thiếu trạng thái resume/review khi retry; ép `"false"` thành `true`; fallback sai mode/type; sai API parser PDF; xử lý ảnh thành binary text/placeholder.
- So sánh hai schema sau thay provider/client path/URL: **khớp**.
- Scan artifact client `.next` hiện có: không thấy `AI_API_KEY`, `AI_BASE_URL`, `gatewayFromEnv`; có đáp án hardcode trong chunk Study.
- Xác nhận không có migration được commit và không có `scripts/integration.mjs`, dù package script tham chiếu file đó.

**Các check chưa chạy hoặc chưa xác nhận**

- Vitest đã thử chạy riêng core nhưng **bị EPERM khi tạo thư mục tạm; không có test nào chạy qua Vitest**.
- Không chạy `auth_dal.test.ts`: `beforeAll` xóa dữ liệu DB đang cấu hình. Kết quả **9/9** trong báo cáo cũ chưa được tái lập.
- Không chạy build, seed, db push, migrate hoặc generate vì sẽ ghi dữ liệu/artifact.
- Chưa chạy HTTP/E2E, concurrency trên PostgreSQL/SQLite thật, SMTP, gateway thật, browser/mobile/screen reader và audit dependency.
- Artifact `.next` có sẵn không được coi là bằng chứng build mới cho revision đang review.

**Các điểm đã thấy và rủi ro còn lại**

Các route sản phẩm đều gọi guard session. Truy vấn document/quiz owner và save/submit attempt có lọc người dùng. Projection câu hỏi cho học sinh dùng allowlist, không trả đáp án/lời giải/seed; shuffle và transient ID có tính xác định. Storage có kiểm tra ownership cho read/remove và chặn traversal rõ ràng. Chưa thấy đường khai thác traversal từ request.

Chưa có `server-only` guard trong các module nhạy cảm. Không thấy lộ khóa trong phạm vi scan, nhưng chưa thể chứng nhận client bundle production mới. `requireRole` chưa được dùng; cần chốt và kiểm thử ma trận quyền Student/Teacher/Admin.

Prompt injection và tính đúng ngữ nghĩa của đáp án chưa được kiểm chứng với model thật. Có structured schema nhưng thiếu bước xác minh nguồn và critique trong luồng thực tế. UI hiện render nội dung như text React, chưa thấy `dangerouslySetInnerHTML`; chưa phát hiện đường XSS từ output trong phạm vi đã đọc.

**Task sửa theo ưu tiên để Gemini điều phối**

1. **P0 — Codex:** Sửa F01, F02; thêm regression cho filter injection, quyền tham gia và submit quá hạn.
2. **P0 — Codex:** Sửa F05, F06, F08, F10; validate request, giới hạn tài nguyên, bảo vệ integrity và transaction.
3. **P0 — Gemini + Codex:** Loại bỏ đường lộ đáp án F04 và tài khoản công khai F13.
4. **P0 — Codex:** Hoàn tất xác minh/reset mật khẩu F03 và migration production F12.
5. **P1 — Codex:** Sửa parser/OCR, fallback và cập nhật chunks: F07, F09, F15.
6. **P1 — Gemini + Codex:** Sửa timer, resume/result, mã thi và câu trả lời văn bản: F11, F14, F16, F17.
7. **P1 — Gemini + Codex:** Hoàn thiện editor/duyệt câu hỏi F18 và API tương ứng.
8. **P1 — Gemini:** Sửa accessibility, mobile và cleanup: F19–F21.
9. **P1 — Gemini điều phối QA:** Chạy build, bộ test DB biệt lập trên cả hai engine, SMTP/AI và E2E; bổ sung script integration còn thiếu, ghi kết quả gắn revision rồi gửi review xác minh lại.