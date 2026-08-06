# Chronicle Electron Dev — Windows Native + WSL Vite
#
# Usage (from Windows PowerShell):
#   cd C:\Chronicle\packages\manager
#   powershell -ExecutionPolicy Bypass -File electron-dev.ps1
#
# Or from WSL:
#   powershell.exe -ExecutionPolicy Bypass -File electron-dev.ps1

param(
  [int]$VitePort = 5173,
  [int]$ElectronDebugPort = 9229
)

$ErrorActionPreference = "Stop"

# ── Ensure Vite is running in WSL ──
Write-Host "[1/3] Checking WSL Vite dev server..." -ForegroundColor Cyan
$wslVite = wsl bash -c "curl -s -o /dev/null -w '%{http_code}' http://localhost:$VitePort 2>/dev/null || echo '000'"

if ($wslVite -ne "200") {
  Write-Host "  Vite not running. Starting in WSL..." -ForegroundColor Yellow
  wsl bash -c "cd /opt/Chronicle/packages/manager && ELECTRON=true npx vite --host 0.0.0.0 --port $VitePort &>/tmp/vite.log &"

  # Wait for Vite to be ready
  $retries = 0
  do {
    Start-Sleep -Seconds 1
    $retries++
    $status = wsl bash -c "curl -s -o /dev/null -w '%{http_code}' http://localhost:$VitePort 2>/dev/null || echo '000'"
    Write-Host "  Waiting for Vite... ($retries/15)" -ForegroundColor Gray
  } while ($status -ne "200" -and $retries -lt 15)

  if ($status -ne "200") {
    Write-Host "  ERROR: Vite failed to start. Check WSL logs: wsl bash -c 'cat /tmp/vite.log'" -ForegroundColor Red
    exit 1
  }
  Write-Host "  Vite ready at http://localhost:$VitePort" -ForegroundColor Green
} else {
  Write-Host "  Vite already running at http://localhost:$VitePort" -ForegroundColor Green
}

# ── Launch Electron ──
Write-Host "[2/3] Starting Windows Electron..." -ForegroundColor Cyan

$env:ELECTRON = "true"
$env:NODE_ENV = "development"
$env:VITE_DEV_URL = "http://localhost:$VitePort"

$electronPath = Join-Path $PSScriptRoot "node_modules\.bin\electron.cmd"
if (-not (Test-Path $electronPath)) {
  # Try npx fallback
  npx electron $PSScriptRoot --dev --inspect=$ElectronDebugPort
} else {
  & $electronPath $PSScriptRoot --dev --inspect=$ElectronDebugPort
}

Write-Host "[3/3] Electron exited." -ForegroundColor Cyan
