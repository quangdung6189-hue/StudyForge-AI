# StudyForge AI - One-click Development Environment Startup
param (
  [switch]$Seed
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   StudyForge AI - Khởi động máy chủ dev" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check Node version
$nodeVersion = node --version
Write-Host "[1/4] Node.js version: $nodeVersion" -ForegroundColor Green

# 2. Database Sync
Write-Host "[2/4] Đồng bộ cơ sở dữ liệu SQLite..." -ForegroundColor Yellow
npm run db:push

# 3. Seed if requested or if DB is empty
if ($Seed -or (-not (Test-Path ".data/dev.db"))) {
  Write-Host "[3/4] Khởi tạo dữ liệu mẫu (Seed)..." -ForegroundColor Yellow
  npm run db:seed
} else {
  Write-Host "[3/4] Bỏ qua seed (DB đã sẵn sàng)" -ForegroundColor DarkGray
}

# 4. Start Next.js Development Server
Write-Host "[4/4] Khởi động Next.js App tại http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host "Tài khoản giáo viên mẫu: giaovien@studyforge.vn / MatKhau123!@" -ForegroundColor White
Write-Host "Tài khoản học sinh mẫu:  hocsinh@studyforge.vn  / MatKhau123!@" -ForegroundColor White
Write-Host "Mã đề thi thử:           SINHHOC8DEMO" -ForegroundColor White
Write-Host "Nhấn Ctrl+C để dừng máy chủ." -ForegroundColor Yellow

npm run dev
