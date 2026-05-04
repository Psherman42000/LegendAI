<#
.SYNOPSIS
  Starts all development services for LegendaAI.
.DESCRIPTION
  Launches PostgreSQL, Redis, optionally Whisper API, Next.js dev server,
  and the background worker - each with status checks and color-coded output.
.PARAMETER SkipWhisper
  Skips starting the Whisper API service.
.EXAMPLE
  .\start-dev.ps1
  .\start-dev.ps1 -SkipWhisper
#>

param(
  [switch]$SkipWhisper,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"

# -- Paths ----------------------------------------------------------
$PgDir     = "C:\tools\postgresql\pgsql"
$PgData    = "$PgDir\data"
$PgCtl     = "$PgDir\bin\pg_ctl.exe"

# Find repo root to locate redis5 regardless of worktree
$RedisDir = "$PSScriptRoot\redis5"
if (-not (Test-Path $RedisDir)) {
    $RedisDir = "$PSScriptRoot\..\..\redis5"
}
$RedisDir = (Resolve-Path $RedisDir -ErrorAction SilentlyContinue).Path
if (-not $RedisDir) {
    $RedisDir = "$PSScriptRoot\redis5"
}
$RedisExe  = "$RedisDir\redis-server.exe"
$RedisCli  = "$RedisDir\redis-cli.exe"
$WhisperDir = "$PSScriptRoot\whisper-api"
$ProjectDir = $PSScriptRoot

# Add tool directories to PATH for this session
$env:Path = "$PgDir;$RedisDir;$env:Path"

# -- Helpers --------------------------------------------------------
function Write-Status {
  param([string]$Label, [bool]$Ok, [string]$Detail = "")
  $symbol = if ($Ok) { "[OK]" } else { "[FAIL]" }
  $color  = if ($Ok) { "Green" } else { "Red" }
  $msg    = if ($Detail) { "$symbol $Label - $Detail" } else { "$symbol $Label" }
  Write-Host $msg -ForegroundColor $color
}

function Test-Port {
  param([int]$Port)
  try { $null -ne (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue) }
  catch { $false }
}

# ===================================================================
#  Stop-DevServices - clean shutdown
# ===================================================================
function Stop-DevServices {
  Write-Host "`nShutting down LegendaAI services..." -ForegroundColor Magenta

  # Next.js + Worker (node processes)
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "next dev|tsx.*worker"
  } | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Status "Node processes" $true "stopped"

  # Whisper API (uvicorn)
  Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Status "Whisper API" $true "stopped"

  # Redis
  try {
    & $RedisCli shutdown 2>$null
    Write-Status "Redis" $true "stopped"
  } catch {
    Write-Status "Redis" $false "could not stop Redis"
  }

  # PostgreSQL
  try {
    & $PgCtl stop -D "$PgData" -m fast 2>$null
    Write-Status "PostgreSQL" $true "stopped"
  } catch {
    Write-Status "PostgreSQL" $false "could not stop PostgreSQL"
  }

  Write-Host "`nAll services stopped.`n" -ForegroundColor Magenta
}

if ($Stop) {
  Stop-DevServices
  exit 0
}

# -- Pre-checks -----------------------------------------------------
Write-Host "`n========== LegendaAI - Development Startup ==========`n" -ForegroundColor Cyan

# Ensure project directory exists
if (-not (Test-Path $ProjectDir)) {
  Write-Status "Project directory" $false "$ProjectDir not found"
  exit 1
}

# -- 1. PostgreSQL --------------------------------------------------
Write-Host "[1/5] PostgreSQL" -ForegroundColor Yellow

$pgRunning = $false
try {
  $pgStatus = & $PgCtl status -D $PgData 2>$null
  $pgRunning = $LASTEXITCODE -eq 0
} catch { $pgRunning = $false }

if ($pgRunning) {
  Write-Status "PostgreSQL" $true "already running"
} else {
  try {
    $pgLog = "$PgData\start-dev.log"
    $pgOut = "$PgData\start-dev.out.log"
    $pgErr = "$PgData\start-dev.err.log"
    $proc = Start-Process -FilePath $PgCtl -ArgumentList "start -D `"$PgData`" -l `"$pgLog`"" -WindowStyle Hidden -PassThru -RedirectStandardOutput $pgOut -RedirectStandardError $pgErr
    Start-Sleep -Seconds 5
    $pgRunning = (& $PgCtl status -D $PgData 2>$null) -and $LASTEXITCODE -eq 0
    if ($pgRunning) { Write-Status "PostgreSQL" $true "started" }
    else            { Write-Status "PostgreSQL" $false "failed to start" }
  }
  catch {
    Write-Status "PostgreSQL" $false $_.Exception.Message
  }
}

# -- 2. Redis -------------------------------------------------------
Write-Host "[2/5] Redis" -ForegroundColor Yellow

$redisRunning = $false
try {
  $redisPing = & $RedisCli ping 2>$null
  if ($redisPing -eq "PONG") { $redisRunning = $true }
} catch { $redisRunning = $false }

if ($redisRunning) {
  Write-Status "Redis" $true "already running"
} else {
  try {
    $proc = Start-Process -FilePath $RedisExe -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3
    $redisPing = & $RedisCli ping 2>$null
    if ($redisPing -eq "PONG") { Write-Status "Redis" $true "started" }
    else                        { Write-Status "Redis" $false "failed to start" }
  }
  catch {
    Write-Status "Redis" $false $_.Exception.Message
  }
}

# Wait for databases to be ready before launching apps
Write-Host "`nWaiting 3 seconds for services to stabilise..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# -- 3. Whisper API (optional) --------------------------------------
Write-Host "[3/5] Whisper API" -ForegroundColor Yellow

$whisperRunning = Test-Port -Port 8000

if ($SkipWhisper) {
  Write-Status "Whisper API" $true "skipped (-SkipWhisper)"
} elseif ($whisperRunning) {
  Write-Status "Whisper API" $true "already running on port 8000"
} elseif (-not (Test-Path "$WhisperDir\main.py")) {
  Write-Status "Whisper API" $true "skipped (main.py not found in whisper-api/)"
} else {
  try {
    $logFile = "$WhisperDir\uvicorn.log"
    $proc = Start-Process -FilePath "uvicorn" `
      -ArgumentList "main:app --host 0.0.0.0 --port 8000" `
      -WorkingDirectory $WhisperDir `
      -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile
    Start-Sleep -Seconds 2
    if (Test-Port -Port 8000) { Write-Status "Whisper API" $true "started on port 8000" }
    else                       { Write-Status "Whisper API" $false "check $logFile for details" }
  }
  catch {
    Write-Status "Whisper API" $false $_.Exception.Message
  }
}

# -- 4. Next.js -----------------------------------------------------
Write-Host "[4/5] Next.js dev server" -ForegroundColor Yellow

try {
  $nextLogOut = "$ProjectDir\.next\dev-server-out.log"
  $nextLogErr = "$ProjectDir\.next\dev-server-err.log"
  $envFile = "$ProjectDir\.env.local"
  $proc = Start-Process -FilePath "npx.cmd" `
    -ArgumentList "tsx", "--env-file=`"$envFile`"", "node_modules/next/dist/bin/next", "dev" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $nextLogOut -RedirectStandardError $nextLogErr
  Start-Sleep -Milliseconds 500
  if ($proc) { try { $proc.Dispose() } catch {} }
  Write-Status "Next.js" $true "launched in background (http://localhost:3000)"
}
catch {
  Write-Status "Next.js" $false $_.Exception.Message
}

# -- 5. Worker ------------------------------------------------------
Write-Host "[5/5] Worker (BullMQ)" -ForegroundColor Yellow

try {
  $workerLogOut = "$ProjectDir\.next\worker-out.log"
  $workerLogErr = "$ProjectDir\.next\worker-err.log"
  $envFile = "$ProjectDir\.env.local"
  $proc = Start-Process -FilePath "npx.cmd" `
    -ArgumentList "tsx", "--env-file=`"$envFile`"", "--watch", "src/workers/videoProcessor.ts" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $workerLogOut -RedirectStandardError $workerLogErr
  Start-Sleep -Milliseconds 500
  if ($proc) { try { $proc.Dispose() } catch {} }
  Write-Status "Worker" $true "launched in background"
}
catch {
  Write-Status "Worker" $false $_.Exception.Message
}

# -- Summary --------------------------------------------------------
Write-Host "`n========== Startup complete =========================`n" -ForegroundColor Cyan
Write-Host "  Next.js  -> http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Whisper  -> http://localhost:8000 (optional)" -ForegroundColor Cyan
Write-Host "  Worker   -> running in separate window" -ForegroundColor Cyan
Write-Host "  Redis    -> localhost:6379" -ForegroundColor Cyan
Write-Host "  Postgres -> localhost:5432" -ForegroundColor Cyan
Write-Host "`nUse .\start-dev.ps1 -Stop to shut everything down.`n" -ForegroundColor DarkGray
