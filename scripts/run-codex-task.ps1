# StudyForge AI - Terminal Codex Task Runner
param (
  [Parameter(Mandatory=$true)]
  [string]$PromptFile,

  [Parameter(Mandatory=$true)]
  [string]$ReportFile,

  [string]$Sandbox = "read-only"
)

if (-not (Test-Path $PromptFile)) {
  Write-Error "Không tìm thấy file prompt: $PromptFile"
  exit 1
}

$reportDir = Split-Path $ReportFile -Parent
if ($reportDir -and (-not (Test-Path $reportDir))) {
  New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
}

Write-Host "Đang dispatch prompt $PromptFile tới Codex CLI (sandbox: $Sandbox)..." -ForegroundColor Cyan
Get-Content -Raw -Encoding UTF8 $PromptFile | codex exec --sandbox $Sandbox --output-last-message $ReportFile -

if ($LASTEXITCODE -eq 0) {
  Write-Host "[✓] Hoàn thành task. Báo cáo được lưu tại: $ReportFile" -ForegroundColor Green
} else {
  Write-Host "[✗] Lỗi khi thực thi task Codex (Exit code: $LASTEXITCODE)" -ForegroundColor Red
  exit $LASTEXITCODE
}
