# Triển khai StudyForge AI lên Vercel

## 1. Thiết lập project

Repository dùng npm workspaces. Ứng dụng Next.js nằm trong `apps/web`, dùng các package chung trong `packages/`.

1. Import repository Git vào Vercel, chọn **Framework Preset: Next.js**.
2. Đặt **Root Directory: `apps/web`**.
3. Bật **Include source files outside of the Root Directory in the Build Step** để build đọc được `packages/` và `scripts/`.
4. Đặt **Node.js Version: 26.x**; `engines.node` trong cả package gốc và `apps/web` đã chọn `26.x`. Vercel ưu tiên cấu hình trong package hơn giá trị Dashboard; minor/patch được nền tảng cập nhật trong nhánh 26.
5. **Install Command: `cd ../.. && npm ci --include=dev --workspaces --include-workspace-root`** để cài đúng lockfile, dependency gốc và các workspace. Script `postinstall` tự sinh Prisma clients. `--include=dev` giữ Prisma CLI và TypeScript trong bước build.
6. Đặt **Build Command: `npm run build`**, chạy trong `apps/web`. Script hiện có sinh Prisma clients rồi chạy `next build --webpack`.
7. Giữ **Output Directory** mặc định của Next.js (`.next`). Không dùng static export vì ứng dụng cần API và session phía server.

`apps/web/vercel.json` đã khai báo Framework, Install Command và Build Command; các giá trị này ưu tiên hơn thiết lập tương ứng trên Dashboard. Không cần adapter riêng. Root Directory và quyền đọc file bên ngoài root vẫn phải đặt trên Dashboard. Các file Prisma được khai báo trong `next.config.ts`; đường dẫn include được tính từ `apps/web`.

Khi nâng từ Node.js 22 lên 26, triển khai commit mới nhất, đặt Dashboard cùng `26.x` và bỏ **Use existing Build Cache** trong lượt đầu. Deployment cũ không đổi runtime cho đến khi được triển khai lại bằng code mới. Local cũng cần Node.js 26.x trước khi cài dependency hoặc chạy kiểm tra; `@types/node` đã được đồng bộ lên nhánh 26.

### Lỗi cài đặt `Cannot find package 'dotenv'`

Chạy `npm install` trực tiếp từ `apps/web` có thể chỉ cài dependency của workspace, bỏ qua dependency ở gốc, nhưng vẫn chạy `postinstall` của gốc. Script `scripts/db.mjs` cần `dotenv` và Prisma CLI ở gốc nên cài đặt sẽ dừng.

Không sửa bằng cách bỏ qua mọi lỗi `postinstall`, cài lại riêng `dotenv` hoặc xóa DB. Dùng Install Command trong `vercel.json` để cài đầy đủ từ gốc repository. Sau khi bản sửa lên GitHub, tạo deployment từ commit mới nhất của `main`; không redeploy lại commit cũ còn thiếu cấu hình. Nếu cần, tắt dùng build cache cho lượt triển khai đầu sau sửa.

Cảnh báo npm `Unknown env config "cache-dir"` không phải nguyên nhân của lỗi thiếu `dotenv`.

### Lỗi đóng gói `ENOENT: lstat .../apps/web/.next/lock`

Next.js tạo `.next/lock` trong lúc build và xóa khi tiến trình kết thúc. File tracing có thể ghi nhầm file khóa tạm vào các manifest `.nft.json`; Vercel đọc manifest sau build nên không tìm thấy file đó. Build Next.js thành công riêng lẻ chưa kiểm tra được bước đóng gói này.

`next.config.ts` đã loại `.next/lock`, output development, cache và build trace log khỏi trace production. Do việc khớp glob có thể khác nhau trên Windows/Linux, script `postbuild` còn dọn đúng các mục tạm đó trong mọi manifest sau khi Next.js thoát, rồi kiểm tra file còn lại bằng `lstat`. Thiếu file runtime hoặc engine Prisma sẽ báo lỗi, không âm thầm bỏ qua. Không tạo file khóa giả hoặc loại toàn bộ `.next` vì cần giữ server chunks thật.

Kiểm tra lại manifest của bản build hiện có từ gốc repository:

```shell
node scripts/check-build-traces.mjs
```

Sau khi bản sửa lên GitHub, triển khai commit mới nhất của `main`, không dùng lại commit lỗi. Tắt **Use existing Build Cache** cho lượt triển khai đầu sau sửa để không tái sử dụng manifest cũ.

## 2. Biến môi trường

Thêm biến trong **Project Settings > Environment Variables**, chọn đúng môi trường Production hoặc Preview, rồi redeploy. Xem `.env.example` để biết đầy đủ biến hiện có; không tải file `.env` lên Git.

| Biến | Giá trị / yêu cầu |
| --- | --- |
| `APP_URL` | Origin HTTPS cố định của website mới, ví dụ `https://studyforge.example.com`; không kèm đường dẫn. |
| `DATABASE_URL` | PostgreSQL production hiện có hoặc database mới đã áp dụng migrations. Không dùng SQLite local. |
| `DATABASE_TRANSPORT` | Mặc định dùng Prisma TCP. Chỉ đặt `websocket` khi chủ động dùng Neon WebSocket adapter. |
| `COOKIE_SECURE` | Đặt `1` trên HTTPS. Không sao chép giá trị `0` dùng cho local. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cần khi dùng đăng nhập Google; chỉ đặt phía server. |
| `AI_BASE_URL`, `AI_API_KEY` | Gateway AI truy cập được từ Internet; `127.0.0.1` trên máy cá nhân không truy cập được từ Vercel. |
| `AI_MODEL_GENERATE`, `AI_MODEL_REVIEW` | Tên model được gateway hỗ trợ. |

Nếu dùng dịch vụ Docling riêng, `DOCLING_BASE_URL` cũng phải truy cập được từ môi trường triển khai; giữ `DOCLING_API_KEY` phía server.

Không đặt thông tin DB, Google client secret hoặc AI key trong biến `NEXT_PUBLIC_*`. Không commit thư mục `.vercel/` vì chứa thông tin liên kết project local.

Trong Google Cloud Console, thêm Authorized redirect URI khớp domain mới:

```text
https://TEN-MIEN-CUA-BAN/api/auth/google/callback
```

Không dựa vào URL Preview ngẫu nhiên cho OAuth production. Preview cần domain/callback riêng và nên dùng database riêng, không dùng chung dữ liệu thật ngoài ý muốn.

## 3. Database và dữ liệu cũ

Chuyển nơi chạy website không cần xóa PostgreSQL/Neon. Giữ đúng `DATABASE_URL` sẽ giữ tài khoản, phiên đăng nhập và dữ liệu đã lưu trong DB.

Nếu database chưa áp dụng migrations mới nhất, sao lưu và kiểm tra đúng database đích trước khi chạy lệnh sau từ gốc repository trong môi trường tin cậy:

```shell
npm run db:migrate
```

Build hiện không tự chạy migrations. Không thêm migration production vào mỗi Preview build. Không chạy seed/reset hoặc nhập lại SQLite vào database đang có dữ liệu.

File gốc đang lưu trong ổ đĩa riêng của máy chủ cũ không tự chuyển theo DB. Giữ bản sao và chuyển sang kho lưu trữ bền vững trước khi ngừng máy chủ cũ.

### Bắt buộc cho bản sửa upload lưu PostgreSQL

Migration `20261101000000_private_document_uploads` **chỉ thêm** `DocumentFile`, `DocumentUpload`, `DocumentUploadPart`, index và khóa ngoại; không xóa tài khoản, tài liệu hoặc đáp án cũ. Cần áp dụng migration bằng `npm run db:migrate` vào đúng PostgreSQL đang đặt trong `DATABASE_URL` của Vercel **trước khi dùng luồng mới**. Kiểm tra đúng DB và sao lưu theo quy trình của nhà cung cấp trước khi chạy. Không dùng `db:push`, `db:seed` hay reset cho production.

Sau deploy, `/api/health` phải có `database: "connected"`, `uploadSchema: "available"`, `documentStorage: "database"`. `UPLOAD_SCHEMA_MISSING` nghĩa là kết nối DB có thể đã hoạt động nhưng thiếu migration; `DATABASE_UNAVAILABLE` là lỗi kết nối khác. API không trả SQL, connection string, đường dẫn engine hoặc binary file trong JSON lỗi.

File cũ trên ổ đĩa local vẫn có đường đọc tương thích khi chạy trên máy cũ. Bản sửa không tự nhập file local cũ lên PostgreSQL; tài liệu không có file gốc trên Vercel cần được tải lại hoặc chuyển riêng trước khi ngừng máy cũ.

## 4. Giới hạn phải xử lý trước khi dùng đầy đủ

Gỡ cấu hình host cũ và build thành công chưa có nghĩa toàn bộ tính năng đã phù hợp Vercel:

- **Lưu file:** file tải mới và metadata được lưu bền vững trong PostgreSQL, cùng quyền sở hữu tài liệu. Không ghi file mới vào `PRIVATE_STORAGE_DIR` hay `/tmp`. File nhị phân làm tăng dung lượng DB và backup; theo dõi quota Neon/PostgreSQL. Khi số lượng tài liệu lớn, nên chuyển binary sang object storage riêng.
- **Upload lớn:** giao diện chia file tối đa 25 MiB thành phần 1 MiB, nhỏ hơn giới hạn request 4.5 MB của Vercel. Backend kiểm tra thứ tự, checksum, tổng kích thước và chủ sở hữu; không tăng giới hạn nền tảng. File gốc được stream và hỗ trợ HTTP Range, không gửi một body buffered 25 MB. Multipart endpoint cũ vẫn chịu giới hạn request của Vercel.
- **AI/OCR lâu:** kiểm tra giới hạn thời gian Functions của gói đang dùng trước khi xử lý file lớn hoặc gọi AI lâu. Có thể cần worker riêng; tăng `AI_TIMEOUT_MS` không tự tăng thời gian chạy Function.
- **Dịch vụ local:** gateway AI hoặc Docling chạy trên máy cá nhân không tự xuất hiện trên Vercel. Cần endpoint riêng truy cập được từ máy chủ mới.

Không thêm nhà cung cấp storage hoặc tạo tài nguyên cloud. Upload dở hết hạn sau 1 giờ và được dọn khi có lần khởi tạo upload tiếp theo; upload hoàn tất xóa các phần trong cùng transaction lưu file gốc. OCR/AI thất bại không được khai báo nhầm là đọc thành công: tài liệu vẫn có thể ở trạng thái `needs_ocr` và cần duyệt.

## 5. Kiểm tra

Từ gốc repository:

```shell
npm run typecheck
npm test
npm run build
```

Sau deploy và migration, kiểm tra `/api/health`, đăng nhập/đăng xuất, upload TXT/DOCX/PDF, file trên 4.5 MB và tab bản gốc. Tài khoản khác/khách phải không đọc được file. Đăng nhập Google vẫn cần domain/callback đúng.

Tài liệu nền tảng:

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Next.js output file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)