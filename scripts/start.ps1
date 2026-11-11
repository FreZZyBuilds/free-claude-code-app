# FCC Studio – one-command start (Windows PowerShell).
#   .\scripts\start.ps1          start fcc-server (if needed) + Studio, open the browser
#   .\scripts\start.ps1 -Dev     Vite dev server with hot reload
param([switch]$Dev)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$App = Join-Path $Root "app"
$FccUrl = if ($env:FCC_URL) { $env:FCC_URL } else { "http://127.0.0.1:8082" }
$Port = if ($env:STUDIO_PORT) { $env:STUDIO_PORT } else { "5174" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20+ is required (https://nodejs.org)." }

function Test-Fcc { try { Invoke-RestMethod -TimeoutSec 2 "$FccUrl/health" | Out-Null; $true } catch { $false } }

$fcc = $null
if (Test-Fcc) { Write-Host "› fcc-server already running at $FccUrl" }
else {
  if (Get-Command fcc-server -ErrorAction SilentlyContinue) {
    Write-Host "› Starting fcc-server…"
    $fcc = Start-Process fcc-server -PassThru -WindowStyle Minimized
  } elseif ((Test-Path (Join-Path $Root "server\pyproject.toml")) -and (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "› Starting fcc-server from .\server via uv…"
    $fcc = Start-Process uv -ArgumentList "run","fcc-server" -WorkingDirectory (Join-Path $Root "server") -PassThru -WindowStyle Minimized
  } else {
    throw "fcc-server not found. Install it from https://github.com/Alishahryar1/free-claude-code#install"
  }
  $i = 0
  while (-not (Test-Fcc)) { Start-Sleep 1; $i++; if ($i -gt 120) { throw "fcc-server did not start." } }
}

Set-Location $App
if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund }
$env:FCC_URL = $FccUrl
try {
  if ($Dev) { Start-Process "http://127.0.0.1:5173"; npx vite }
  else {
    if (-not (Test-Path dist\index.html)) { npm run build }
    $env:STUDIO_PORT = $Port
    Start-Process "http://127.0.0.1:$Port"
    node server.mjs
  }
} finally { if ($fcc) { Stop-Process -Id $fcc.Id -ErrorAction SilentlyContinue } }
