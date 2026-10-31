# Triển khai StudyForge AI lên Vercel

## 1. Thiết lập project

Repository dùng npm workspaces. Ứng dụng Next.js nằm trong `apps/web`, dùng các package chung trong `packages/`.

1. Import repository Git vào Vercel, chọn **Framework Preset: Next.js**.
2. Đặt **Root Directory: `apps/web`**.
3. Bật **Include source files outside of the Root Directory in the Build Step** để build đọc được `packages/` và `scripts/`.
4. Đặt **Node.js Version: 22.x**; repository yêu cầu Node.js từ 22.12 đến trước 23, không tự chọn Node.js 26.
5. **Install Command: `cd ../.. && npm ci --include=dev --workspaces --include-workspace-root`** để cài đúng lockfile, dependency gốc và các workspace. Script `postinstall` tự sinh Prisma clients. `--include=dev` giữ Prisma CLI và TypeScript trong bước build.
6. Đặt **Build Command: `npm run build`**, chạy trong `apps/web`. Script hiện có sinh Prisma clients rồi chạy `next build --webpack`.
7. Giữ **Output Directory** mặc định của Next.js (`.next`). Không dùng static export vì ứng dụng cần API và session phía server.

`apps/web/vercel.json` đã khai báo Framework, Install Command và Build Command; các giá trị này ưu tiên hơn thiết lập tương ứng trên Dashboard. Không cần adapter riêng. Root Directory và quyền đọc file bên ngoài root vẫn phải đặt trên Dashboard. Các file Prisma được khai báo trong `next.config.ts`; đường dẫn include được tính từ `apps/web`.

### Lỗi cài đặt `Cannot find package 'dotenv'`

Chạy `npm install` trực tiếp từ `apps/web` có thể chỉ cài dependency của workspace, bỏ qua dependency ở gốc, nhưng vẫn chạy `postinstall` của gốc. Script `scripts/db.mjs` cần `dotenv` và Prisma CLI ở gốc nên cài đặt sẽ dừng.

Không sửa bằng cách bỏ qua mọi lỗi `postinstall`, cài lại riêng `dotenv` hoặc xóa DB. Dùng Install Command trong `vercel.json` để cài đầy đủ từ gốc repository. Sau khi bản sửa lên GitHub, tạo deployment từ commit mới nhất của `main`; không redeploy lại commit cũ còn thiếu cấu hình. Nếu cần, tắt dùng build cache cho lượt triển khai đầu sau sửa.

Cảnh báo npm `Unknown env config "cache-dir"` không phải nguyên nhân của lỗi thiếu `dotenv`.

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

## 4. Giới hạn phải xử lý trước khi dùng đầy đủ

Gỡ cấu hình host cũ và build thành công chưa có nghĩa toàn bộ tính năng đã phù hợp Vercel:

- **Lưu file:** `packages/storage` hiện chỉ có `LocalPrivateStorage`. File gốc dùng `PRIVATE_STORAGE_DIR`; metadata trích xuất dùng `.data/document-extraction`. Filesystem ứng dụng trên Vercel không phải ổ ghi bền vững. `/tmp` chỉ là vùng tạm, không bảo đảm chia sẻ giữa các instance hoặc còn sau redeploy. Không dùng `/tmp` làm kho tài liệu lâu dài. Cần chuyển file và metadata sang kho lưu trữ bền vững, giữ kiểm tra session/quyền sở hữu tại backend.
- **Upload lớn:** Vercel Functions giới hạn request/response body 4.5 MB. Giá trị `MAX_UPLOAD_BYTES=268435456` trong cấu hình mẫu không tăng được giới hạn nền tảng. Upload lớn cần luồng tải trực tiếp vào kho riêng với quyền tạm thời do backend xác thực cấp; chưa có trong adapter hiện tại.
- **AI/OCR lâu:** kiểm tra giới hạn thời gian Functions của gói đang dùng trước khi xử lý file lớn hoặc gọi AI lâu. Có thể cần worker riêng; tăng `AI_TIMEOUT_MS` không tự tăng thời gian chạy Function.
- **Dịch vụ local:** gateway AI hoặc Docling chạy trên máy cá nhân không tự xuất hiện trên Vercel. Cần endpoint riêng truy cập được từ máy chủ mới.

Phần chuẩn bị triển khai này không thêm nhà cung cấp storage, không chuyển file, không đổi dữ liệu, không tạo tài nguyên cloud và không triển khai lên tài khoản Vercel.

## 5. Kiểm tra

Từ gốc repository:

```shell
npm run typecheck
npm test
npm run build
```

Sau deploy, kiểm tra `/api/health`, đăng nhập/đăng xuất và Google callback. Chỉ kiểm tra luồng upload/tải lại file như chức năng production hoàn chỉnh sau khi xử lý lưu trữ bền vững và giới hạn upload ở trên.

Tài liệu nền tảng:

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Next.js output file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)