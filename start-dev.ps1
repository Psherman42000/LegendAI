<#
.SYNOPSIS
  Starts or stops all development services for LegendaAI with PID tracking.
.DESCRIPTION
  Manages PostgreSQL, Redis, Whisper API, Next.js dev server, background worker,
  and OpenCode server - each with status checks and color-coded output.
  Tracks PIDs in .dev-services.json for reliable shutdown.
.PARAMETER SkipWhisper
  Skips starting the Whisper API service.
.PARAMETER Stop
  Stops all tracked services.
.EXAMPLE
  .\start-dev.ps1
  .\start-dev.ps1 -SkipWhisper
  .\start-dev.ps1 -Stop
#>

param(
  [switch]$SkipWhisper,
  [switch]$SkipOpenCode,
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
$PidFile    = "$ProjectDir\.dev-services.json"

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

function Get-TrackedPids {
  if (Test-Path $PidFile) {
    try { return Get-Content $PidFile -Raw | ConvertFrom-Json -AsHashtable }
    catch { return @{} }
  }
  return @{}
}

function Save-TrackedPids {
  param([hashtable]$Pids)
  $Pids | ConvertTo-Json | Set-Content $PidFile -Force
}

function Remove-TrackedPids {
  if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
}

function Stop-ProcessByPid {
  param([int]$Pid, [string]$Name)
  try {
    $proc = Get-Process -Id $Pid -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
      # Wait up to 5 seconds for process to exit
      $timeout = 0
      while ((Get-Process -Id $Pid -ErrorAction SilentlyContinue) -and $timeout -lt 50) {
        Start-Sleep -Milliseconds 100
        $timeout++
      }
      return $true
    }
    return $false
  }
  catch { return $false }
}

# ===================================================================
#  Stop-DevServices - clean shutdown
# ===================================================================
function Stop-DevServices {
  Write-Host "`nShutting down LegendaAI services..." -ForegroundColor Magenta

  $tracked = Get-TrackedPids
  $anyStopped = $false

  # Stop tracked Node processes (Next.js, Worker)
  if ($tracked.nextjs) {
    $stopped = Stop-ProcessByPid -Pid $tracked.nextjs -Name "Next.js"
    if ($stopped) { Write-Status "Next.js" $true "stopped (PID $($tracked.nextjs))"; $anyStopped = $true }
    else { Write-Status "Next.js" $false "not running or already stopped" }
  }
  if ($tracked.worker) {
    $stopped = Stop-ProcessByPid -Pid $tracked.worker -Name "Worker"
    if ($stopped) { Write-Status "Worker" $true "stopped (PID $($tracked.worker))"; $anyStopped = $true }
    else { Write-Status "Worker" $false "not running or already stopped" }
  }

  # Stop tracked Whisper API (uvicorn)
  if ($tracked.whisper) {
    $stopped = Stop-ProcessByPid -Pid $tracked.whisper -Name "Whisper API"
    if ($stopped) { Write-Status "Whisper API" $true "stopped (PID $($tracked.whisper))"; $anyStopped = $true }
    else { Write-Status "Whisper API" $false "not running or already stopped" }
  }

  # Stop tracked OpenCode server
  if ($tracked.opencode) {
    $stopped = Stop-ProcessByPid -Pid $tracked.opencode -Name "OpenCode"
    if ($stopped) { Write-Status "OpenCode" $true "stopped (PID $($tracked.opencode))"; $anyStopped = $true }
    else { Write-Status "OpenCode" $false "not running or already stopped" }
  }

  # Kill any remaining opencode/node processes by port (fallback)
  if (Test-Port -Port 4096) {
    $proc = Get-NetTCPConnection -LocalPort 4096 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and $proc.OwningProcess) {
      Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Status "OpenCode (port fallback)" $true "killed process on port 4096"
      $anyStopped = $true
    }
  }

  # Redis
  try {
    & $RedisCli shutdown 2>$null
    Start-Sleep -Seconds 2
    if (-not (Test-Port -Port 6379)) {
      Write-Status "Redis" $true "stopped"
      $anyStopped = $true
    } else {
      # Force kill if graceful shutdown failed
      $tracked.redis = Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
      if ($tracked.redis) {
        Stop-Process -Id $tracked.redis -Force -ErrorAction SilentlyContinue
        Write-Status "Redis" $true "force stopped"
        $anyStopped = $true
      }
    }
  } catch {
    Write-Status "Redis" $false "could not stop: $_"
  }

  # PostgreSQL
  try {
    & $PgCtl stop -D "$PgData" -m fast 2>$null
    Start-Sleep -Seconds 2
    Write-Status "PostgreSQL" $true "stopped"
    $anyStopped = $true
  } catch {
    Write-Status "PostgreSQL" $false "could not stop: $_"
  }

  # Cleanup PID file
  Remove-TrackedPids

  # Final check for orphaned processes
  $orphanedNode = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "next dev|tsx.*worker|opencode" -or $_.Parent.Id -eq 1
  }
  if ($orphanedNode) {
    Write-Host "`n[WARN] Found orphaned Node processes:" -ForegroundColor Yellow
    $orphanedNode | ForEach-Object { Write-Host "  PID $($_.Id): $($_.CommandLine.Substring(0, [Math]::Min(80, $_.CommandLine.Length)))..." -ForegroundColor DarkGray }
    Write-Host "Run 'taskkill /F /IM node.exe' to clean up if needed." -ForegroundColor DarkGray
  }

  if ($anyStopped) {
    Write-Host "`nAll services stopped.`n" -ForegroundColor Magenta
  } else {
    Write-Host "`nNo active services found.`n" -ForegroundColor Magenta
  }
}

if ($Stop) {
  Stop-DevServices
  exit 0
}

# -- Pre-checks -----------------------------------------------------
Write-Host "`n========== LegendaAI - Development Startup ==========`n" -ForegroundColor Cyan

# Load existing PIDs to avoid duplicates
$existing = Get-TrackedPids
$activePids = @{}

# -- 1. PostgreSQL --------------------------------------------------
Write-Host "[1/6] PostgreSQL" -ForegroundColor Yellow

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
    $pgProc = Start-Process -FilePath $PgCtl -ArgumentList "start -D `"$PgData`" -l `"$pgLog`"" -WindowStyle Hidden -PassThru -RedirectStandardOutput $pgOut -RedirectStandardError $pgErr
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
Write-Host "[2/6] Redis" -ForegroundColor Yellow

$redisRunning = $false
try {
  $redisPing = & $RedisCli ping 2>$null
  if ($redisPing -eq "PONG") { $redisRunning = $true }
} catch { $redisRunning = $false }

if ($redisRunning) {
  Write-Status "Redis" $true "already running"
} else {
  try {
    $redisProc = Start-Process -FilePath $RedisExe -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3
    $redisPing = & $RedisCli ping 2>$null
    if ($redisPing -eq "PONG") {
      Write-Status "Redis" $true "started (PID $($redisProc.Id))"
      $activePids.redis = $redisProc.Id
    }
    else {
      Write-Status "Redis" $false "failed to start"
      if ($redisProc) { Stop-Process -Id $redisProc.Id -Force -ErrorAction SilentlyContinue }
    }
  }
  catch {
    Write-Status "Redis" $false $_.Exception.Message
  }
}

# Wait for databases before launching apps
Write-Host "`nWaiting 3 seconds for services to stabilise..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# -- 3. Whisper API (optional) --------------------------------------
Write-Host "[3/6] Whisper API" -ForegroundColor Yellow

$whisperRunning = Test-Port -Port 8000

if ($SkipWhisper) {
  Write-Status "Whisper API" $true "skipped (-SkipWhisper)"
} elseif ($whisperRunning) {
  Write-Status "Whisper API" $true "already running on port 8000"
} elseif (-not (Test-Path "$WhisperDir\main.py")) {
  Write-Status "Whisper API" $true "skipped (main.py not found in whisper-api/)"
} else {
  try {
    $whisperLogOut = "$WhisperDir\uvicorn-out.log"
    $whisperLogErr = "$WhisperDir\uvicorn-err.log"
    $whisperProc = Start-Process -FilePath "uvicorn" `
      -ArgumentList "main:app --host 0.0.0.0 --port 8000" `
      -WorkingDirectory $WhisperDir `
      -NoNewWindow -PassThru -RedirectStandardOutput $whisperLogOut -RedirectStandardError $whisperLogErr
    Start-Sleep -Seconds 2
    if (Test-Port -Port 8000) {
      Write-Status "Whisper API" $true "started on port 8000 (PID $($whisperProc.Id))"
      $activePids.whisper = $whisperProc.Id
    }
    else {
      Write-Status "Whisper API" $false "check $whisperLogErr for details"
      if ($whisperProc) { Stop-Process -Id $whisperProc.Id -Force -ErrorAction SilentlyContinue }
    }
  }
  catch {
    Write-Status "Whisper API" $false $_.Exception.Message
  }
}

# -- 4. OpenCode Server (optional) ----------------------------------
Write-Host "[4/6] OpenCode Server" -ForegroundColor Yellow

$opencodeRunning = Test-Port -Port 4096

if ($SkipOpenCode) {
  Write-Status "OpenCode" $true "skipped (-SkipOpenCode)"
} elseif ($opencodeRunning) {
  Write-Status "OpenCode" $true "already running on port 4096"
} else {
  try {
    $opencodeLogOut = "$ProjectDir\.next\opencode-out.log"
    $opencodeLogErr = "$ProjectDir\.next\opencode-err.log"
    $opencodeProc = Start-Process -FilePath "opencode.cmd" `
      -ArgumentList "serve", "--port", "4096" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $opencodeLogOut -RedirectStandardError $opencodeLogErr
    Start-Sleep -Seconds 3
    if (Test-Port -Port 4096) {
      Write-Status "OpenCode" $true "started on port 4096 (PID $($opencodeProc.Id))"
      $activePids.opencode = $opencodeProc.Id
    }
    else {
      Write-Status "OpenCode" $false "check $opencodeLogErr for details"
      if ($opencodeProc) { Stop-Process -Id $opencodeProc.Id -Force -ErrorAction SilentlyContinue }
    }
  }
  catch {
    Write-Status "OpenCode" $false $_.Exception.Message
  }
}

# -- 5. Next.js -----------------------------------------------------
Write-Host "[5/6] Next.js dev server" -ForegroundColor Yellow

if ($existing.nextjs -and (Get-Process -Id $existing.nextjs -ErrorAction SilentlyContinue)) {
  Write-Status "Next.js" $true "already running (PID $($existing.nextjs))"
  $activePids.nextjs = $existing.nextjs
} else {
  try {
    $nextLogOut = "$ProjectDir\.next\dev-server-out.log"
    $nextLogErr = "$ProjectDir\.next\dev-server-err.log"
    $nextProc = Start-Process -FilePath "npx.cmd" `
      -ArgumentList "next", "dev" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $nextLogOut -RedirectStandardError $nextLogErr
    Start-Sleep -Seconds 2
    if ($nextProc -and (Get-Process -Id $nextProc.Id -ErrorAction SilentlyContinue)) {
      Write-Status "Next.js" $true "launched in background (PID $($nextProc.Id), http://localhost:3000)"
      $activePids.nextjs = $nextProc.Id
    } else {
      Write-Status "Next.js" $false "failed to start"
    }
  }
  catch {
    Write-Status "Next.js" $false $_.Exception.Message
  }
}

# -- 6. Worker ------------------------------------------------------
Write-Host "[6/6] Worker (BullMQ)" -ForegroundColor Yellow

if ($existing.worker -and (Get-Process -Id $existing.worker -ErrorAction SilentlyContinue)) {
  Write-Status "Worker" $true "already running (PID $($existing.worker))"
  $activePids.worker = $existing.worker
} else {
  try {
    $workerLogOut = "$ProjectDir\.next\worker-out.log"
    $workerLogErr = "$ProjectDir\.next\worker-err.log"
    $envFile = "$ProjectDir\.env.local"
    $workerProc = Start-Process -FilePath "npx.cmd" `
      -ArgumentList "tsx", "--env-file=`"$envFile`"", "--watch", "src/workers/videoProcessor.ts" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $workerLogOut -RedirectStandardError $workerLogErr
    Start-Sleep -Seconds 2
    if ($workerProc -and (Get-Process -Id $workerProc.Id -ErrorAction SilentlyContinue)) {
      Write-Status "Worker" $true "launched in background (PID $($workerProc.Id))"
      $activePids.worker = $workerProc.Id
    } else {
      Write-Status "Worker" $false "failed to start"
    }
  }
  catch {
    Write-Status "Worker" $false $_.Exception.Message
  }
}

# -- Save PIDs ------------------------------------------------------
if ($activePids.Count -gt 0) {
  Save-TrackedPids -Pids $activePids
}

# -- Summary --------------------------------------------------------
Write-Host "`n========== Startup complete =========================`n" -ForegroundColor Cyan
Write-Host "  Next.js  -> http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Whisper  -> http://localhost:8000 (optional)" -ForegroundColor Cyan
Write-Host "  OpenCode -> http://localhost:4096 (optional)" -ForegroundColor Cyan
Write-Host "  Worker   -> running in background" -ForegroundColor Cyan
Write-Host "  Redis    -> localhost:6379" -ForegroundColor Cyan
Write-Host "  Postgres -> localhost:5432" -ForegroundColor Cyan
Write-Host "`nUse .\start-dev.ps1 -Stop to shut everything down.`n" -ForegroundColor DarkGray
