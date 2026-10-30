# Đăng nhập Google và database online

## Trạng thái đã cấu hình

- Google Cloud project: `studyforge-ai-512309`, OAuth client **StudyForge Web**; callback `http://localhost:3000/api/auth/google/callback`. App đang ở chế độ **Testing**, tài khoản Google dùng thiết lập đã được thêm vào test users.
- PostgreSQL Neon **Free plan**: project `late-leaf-30930394`, branch `br-winter-rain-b59f5gwx`, database `neondb`. Website hiện dùng database này qua `DATABASE_URL` phía server.
- Hai migrations PostgreSQL đã được áp dụng. Đã nhập và xác minh 134 bản ghi từ SQLite, bao gồm 7 tài khoản, 6 session, 4 tài liệu, 23 câu hỏi, 3 đề thi và các bảng liên quan. ID, bcrypt hash và session hash được giữ nguyên.
- Bản sao trước chuyển đổi: `.data/backups/pre-cloud-20261021-171923.db`; database SQLite gốc vẫn còn.
- Client ID/secret và connection string chỉ nằm trong `.env` cùng bản sao riêng dưới `.data/`, đều bị Git bỏ qua. Không chép các giá trị này vào tài liệu hoặc client code.
- Đã liên kết thành công với tài khoản StudyForge cũ sau khi người dùng đăng nhập đúng tài khoản có cùng email. Lần đăng nhập Google tiếp theo đã về `/dashboard`, giữ nguyên user ID và tạo session mới mà không nhập mật khẩu StudyForge. Các hash mật khẩu cũ vẫn được giữ nguyên. Không dùng mật khẩu Google để nhập vào StudyForge.

Các bước phía dưới dùng khi thiết lập lại hoặc triển khai sang môi trường khác. Cấu hình production cần domain HTTPS và redirect URI riêng.

Website hiện lưu tài khoản và phiên đăng nhập bằng Prisma. Khi không cấu hình `DATABASE_URL`, môi trường phát triển dùng `.data/dev.db` (SQLite). Đăng ký email/mật khẩu lưu **bcrypt hash**, không lưu mật khẩu gốc. Đăng nhập Google lưu mã định danh ổn định `googleSubject`, email đã xác minh và tên; Google không cung cấp mật khẩu cho website. Google access token và refresh token không được lưu.

## 1. Cấu hình Google Cloud

Đăng nhập [Google Cloud Console](https://console.cloud.google.com/auth/clients) bằng tài khoản Google của bạn. Phiên đăng nhập trong Antigravity không tự cấp quyền cho ứng dụng hoặc cho phiên terminal này.

1. Chọn hoặc tạo project riêng cho StudyForge; cấu hình Google Auth Platform (tên ứng dụng, email hỗ trợ, audience). Nếu ứng dụng đang ở chế độ Testing, thêm email của bạn vào Test users.
2. Tạo OAuth client loại **Web application**.
3. Thêm Authorized redirect URI chính xác: `http://localhost:3000/api/auth/google/callback`. Khi triển khai, thêm `https://TEN-MIEN-CUA-BAN/api/auth/google/callback`.
4. Đặt các biến sau trong `.env` ở thư mục gốc khi chạy local, hoặc secret/environment settings của máy chủ khi triển khai:

```dotenv
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

`APP_URL` phải trùng origin người dùng mở trên trình duyệt. Production yêu cầu HTTPS. Các khóa phải nằm phía server, không dùng tiền tố `NEXT_PUBLIC_`, không commit `.env` và không gửi secret trong chat.

Khởi động lại `npm.cmd run dev`. Nút **Tiếp tục với Google** chỉ được bật khi cấu hình đủ. Người dùng chọn tài khoản và đồng ý trên trang Google chính thức. Ứng dụng chỉ yêu cầu `openid email profile`.

Nguồn: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google OAuth cho web server](https://developers.google.com/identity/protocols/oauth2/web-server).

## 2. Kết nối PostgreSQL online

Có thể dùng PostgreSQL của Supabase, Neon hoặc nhà cung cấp hiện có; không cần đổi mô hình dữ liệu của ứng dụng. Tạo project database bằng tài khoản của bạn, rồi lưu connection string phía server:

```dotenv
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Dùng kết nối trực tiếp hoặc pool ở chế độ session tương thích với Prisma và migrations. Nếu dùng Supabase chỉ qua Prisma, tắt Supabase Data API theo [hướng dẫn chính thức](https://supabase.com/docs/guides/database/prisma), để bảng người dùng và session không được truy cập bằng anon API. Mật khẩu trong connection string là mật khẩu database, không phải mật khẩu Google.

Với **database PostgreSQL mới, trống**, chạy:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run check:auth
```

Migration `0_initial` tạo schema cũ; `20261021000000_google_auth` thêm Google OAuth và cho phép tài khoản không có mật khẩu. Migration nâng cấp này không xóa tài khoản hoặc dữ liệu học tập.

Với PostgreSQL đã có đủ bảng của schema **trước khi thêm Google**, nhưng chưa có lịch sử Prisma migrations, kiểm tra schema và sao lưu trước; đánh dấu baseline rồi mới nâng cấp:

```powershell
node --env-file=.env node_modules/prisma/build/index.js migrate resolve --schema packages/db/prisma/schema.prisma --applied 0_initial
npm.cmd run db:migrate
```

Không đánh dấu migration đã áp dụng nếu schema thực tế chưa khớp. Tham khảo [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).

Đổi `DATABASE_URL` chỉ đổi nơi ứng dụng kết nối; **không tự chuyển dữ liệu SQLite cũ lên PostgreSQL**. Với một database đích mới và trống, có thể nhập một bản sao SQLite đã chốt trong lúc app dừng:

```powershell
npm.cmd run db:import:sqlite -- --source .data/backups/YOUR-BACKUP.db
```

Script nhập trong một transaction, kiểm tra số bản ghi từng bảng và từ chối ghi đè khi đích không trống. Lần chuyển sang Neon ở trên đã hoàn tất; không chạy lại vào database đang dùng.

Seed cũ có hành vi reset dữ liệu, nên nay sẽ dừng nếu database đã có tài khoản. Không bật `ALLOW_DATABASE_RESET=true` cho database đang dùng.

## 3. Hành vi đăng nhập và liên kết

- Tài khoản Google mới được tạo với quyền `student`; `passwordHash` là `null`.
- Nếu email đã có tài khoản mật khẩu, ứng dụng không tự gộp tài khoản. Đăng nhập bằng mật khẩu, mở **Tài khoản & liên kết Google** trong thanh bên và chọn **Liên kết tài khoản Google**. Phải chọn Google có cùng email. Mật khẩu và quyền cũ được giữ nguyên.
- Email đăng ký bằng mật khẩu không bị đánh dấu đã xác minh khi chưa xác minh thực tế.
- Phiên đăng nhập dùng cookie HttpOnly; database chỉ lưu SHA-256 hash của session token. OAuth dùng state một lần trong database, cookie ràng buộc trình duyệt, PKCE và nonce; ID token được xác minh chữ ký, issuer, audience, thời hạn và email đã xác minh.
- Cookie `studyforge_session` hiện có thời hạn 14 ngày theo `apps/web/src/server/auth.ts`.

## 4. Kiểm tra

```powershell
npm.cmd run check:auth
npm.cmd run check:auth -- --live-google --stored-google
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser:auth
npm.cmd run build
```

`check:auth` kiểm tra kết nối và các bảng auth mà không in secret. Cả bộ test Google và Auth/DAL đều dùng database SQLite riêng; không reset database ứng dụng. Bộ test Google dùng khóa RSA kiểm thử và phản hồi Google mô phỏng, không cần tài khoản Google thật.

Kiểm tra Chrome thật đã xác minh mobile 375px, desktop, light/dark, reduced motion, bàn phím, đăng ký/đăng nhập với Neon, session qua lần mở lại, đăng xuất, UI liên kết và lỗi extension/hydration. Ảnh và báo cáo JSON ở `.data/browser-auth-checks/`.

Google OAuth không tự gộp tài khoản trùng email. Những tài khoản khác muốn liên kết vẫn cần đăng nhập tài khoản StudyForge cũ có cùng email; tài khoản dùng thiết lập này đã hoàn tất bước đó.
