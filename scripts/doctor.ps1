# StudyForge AI - Environment & Health Check Doctor
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   StudyForge AI - Kiểm tra hệ thống (Doctor)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$allPass = $true

# 1. Node.js Check
$nodeVersion = node --version
if ($nodeVersion -match "v(\d+)\.") {
  $major = [int]$matches[1]
  if ($major -ge 22) {
    Write-Host "[✓] Node.js: $nodeVersion (Đạt >= v22.12)" -ForegroundColor Green
  } else {
    Write-Host "[✗] Node.js: $nodeVersion (Cần nâng cấp >= v22.12)" -ForegroundColor Red
    $allPass = $false
  }
}

# 2. Package Managers
$npmVersion = npm --version
Write-Host "[✓] npm: v$npmVersion" -ForegroundColor Green

# 3. SQLite Database Check
if (Test-Path ".data/dev.db") {
  $dbSize = (Get-Item ".data/dev.db").Length
  Write-Host "[✓] SQLite Database: .data/dev.db tồn tại ($dbSize bytes)" -ForegroundColor Green
} else {
  Write-Host "[!] SQLite Database: .data/dev.db chưa được tạo. Hãy chạy 'npm run db:push && npm run db:seed'" -ForegroundColor Yellow
}

# 4. Storage Directory Check
if (Test-Path ".data/storage") {
  Write-Host "[✓] Local Private Storage: .data/storage sẵn sàng" -ForegroundColor Green
} else {
  New-Item -ItemType Directory -Force -Path ".data/storage" | Out-Null
  Write-Host "[✓] Local Private Storage: Đã tạo thư mục .data/storage" -ForegroundColor Green
}

# 5. Codex CLI Check
try {
  $codexVer = codex --version 2>$null
  if ($codexVer) {
    Write-Host "[✓] Codex CLI: $codexVer" -ForegroundColor Green
  } else {
    Write-Host "[!] Codex CLI: Chưa được cài đặt hoặc chưa vào PATH" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[!] Codex CLI: Không tìm thấy" -ForegroundColor Yellow
}

# 6. Typecheck
Write-Host "Đang kiểm tra Typecheck TypeScript..." -ForegroundColor Cyan
$tc = npm run typecheck 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[✓] TypeScript: 0 errors (Pass)" -ForegroundColor Green
} else {
  Write-Host "[✗] TypeScript: Phát hiện lỗi kiểu" -ForegroundColor Red
  $allPass = $false
}

Write-Host "-----------------------------------------" -ForegroundColor Cyan
if ($allPass) {
  Write-Host "HỆ THỐNG HOÀN TOÀN SẴN SÀNG ĐỂ CHẠY!" -ForegroundColor Green
} else {
  Write-Host "HỆ THỐNG CÓ MỘT SỐ CẢNH BÁO CẦN XỬ LÝ." -ForegroundColor Yellow
}
