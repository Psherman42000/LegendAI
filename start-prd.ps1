<#
.SYNOPSIS
  Starts or stops all production services for LegendaAI with PID tracking.
.DESCRIPTION
  Manages PostgreSQL, Redis, Whisper API, Next.js production server (next start),
  and background worker - each with status checks and color-coded output.
  Uses .env.production for environment configuration.
  Runs `next build` automatically if the .next build output is missing or stale.
.PARAMETER SkipWhisper
  Skips starting the Whisper API service.
.PARAMETER SkipBuild
  Skips the automatic `next build` step (use if you already built recently).
.PARAMETER Stop
  Stops all tracked services.
.EXAMPLE
  .\start-prd.ps1
  .\start-prd.ps1 -SkipWhisper
  .\start-prd.ps1 -SkipBuild
  .\start-prd.ps1 -Stop
#>

param(
  [switch]$SkipWhisper,
  [switch]$SkipBuild,
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
$RedisExe    = "$RedisDir\redis-server.exe"
$RedisCli    = "$RedisDir\redis-cli.exe"
$WhisperDir  = "$PSScriptRoot\whisper-api"
$ProjectDir  = $PSScriptRoot
$PidFile     = "$ProjectDir\.prd-services.json"
$LogDir      = "$ProjectDir\logs"
$EnvFile     = "$ProjectDir\.env.production"
$NextBuildDir = "$ProjectDir\.next"

# Ensure log directory exists
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

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
  try { 
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    $null -ne ($conn | Where-Object State -EQ "Listen" | Select-Object -First 1)
  }
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

function Kill-ProjectNodeProcesses {
  <#
    .SYNOPSIS
      Kills ALL Node.js processes from the current project (next start, tsx workers)
      using WMI/CIM to check command lines. Works in PowerShell 5.1.
  #>
  $projectPath = $ProjectDir.Replace('\', '\\')
  $nodeProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  $toKill = $nodeProcs | Where-Object {
    $cmd = $_.CommandLine
    $cmd -match $projectPath -and
    $cmd -match "(next|tsx|worker)" -and
    $cmd -notmatch "opencode"
  }
  $total = 0
  foreach ($p in $toKill) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
      $total++
      Write-Host "  Killed PID $($p.ProcessId) ($($p.CommandLine.Substring(0, [Math]::Min(80, $p.CommandLine.Length))))" -ForegroundColor DarkGray
    } catch { }
  }
  if ($total -gt 0) {
    Write-Host "  Killed $total orphaned Node process(es)" -ForegroundColor Gray
  }
  Remove-TrackedPids
}

# ===================================================================
#  Stop-PrdServices - clean shutdown
# ===================================================================
function Stop-PrdServices {
  Write-Host "`nShutting down LegendaAI production services..." -ForegroundColor Magenta

  # Kill ALL project Node processes by command line (catches orphans)
  Kill-ProjectNodeProcesses

  # Whisper API (port 8000)
  if (Test-Port -Port 8000) {
    try {
      $p = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($p -and $p.OwningProcess) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Status "Whisper API" $true "stopped"
      }
    } catch {
      Write-Status "Whisper API" $false "could not stop"
    }
  } else {
    Write-Status "Whisper API" $true "not running"
  }

  # Redis
  try {
    & $RedisCli shutdown 2>$null
    Start-Sleep -Seconds 2
    if (-not (Test-Port -Port 6379)) {
      Write-Status "Redis" $true "stopped"
    } else {
      $redisPid = Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
      if ($redisPid) {
        Stop-Process -Id $redisPid -Force -ErrorAction SilentlyContinue
        Write-Status "Redis" $true "force stopped"
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
  } catch {
    Write-Status "PostgreSQL" $false "could not stop: $_"
  }

  # Verify: kill anything still listening on project ports
  @(3000, 8000) | ForEach-Object {
    $port = $_
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Status "Port $port" $true "force killed"
    }
  }

  Write-Host "`nAll production services stopped.`n" -ForegroundColor Magenta
}

if ($Stop) {
  Stop-PrdServices
  exit 0
}

# -- Pre-start cleanup: kill orphans before starting fresh ----------
Write-Host "`nCleaning up orphaned processes from previous runs..." -ForegroundColor DarkGray
Kill-ProjectNodeProcesses

Write-Host "`n========== LegendaAI - Production Startup ==========`n" -ForegroundColor Green

$activePids = @{}
# Clean up old PID file
Remove-TrackedPids

# -- 0. Verify .env.production exists --------------------------------
Write-Host "[0/6] Environment" -ForegroundColor Yellow

if (Test-Path $EnvFile) {
  Write-Status ".env.production" $true "found"
} else {
  Write-Status ".env.production" $false "NOT FOUND - create it before running production"
  exit 1
}

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
    $pgLog = "$PgData\start-prd.log"
    $pgOut = "$PgData\start-prd.out.log"
    $pgErr = "$PgData\start-prd.err.log"
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
    $whisperLogOut = "$WhisperDir\uvicorn-prd-out.log"
    $whisperLogErr = "$WhisperDir\uvicorn-prd-err.log"
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

# -- 4. Next.js build (if needed) -----------------------------------
Write-Host "[4/6] Next.js build" -ForegroundColor Yellow

if ($SkipBuild) {
  Write-Status "Build" $true "skipped (-SkipBuild)"
} elseif (-not (Test-Path "$NextBuildDir\BUILD_ID")) {
  Write-Host "  No build found. Running next build..." -ForegroundColor DarkGray
  try {
    $buildLogOut = "$LogDir\build-out.log"
    $buildLogErr = "$LogDir\build-err.log"
    $env:NODE_ENV = "production"
    & node "$ProjectDir\node_modules\.bin\next" build 2>&1 | Tee-Object -FilePath $buildLogOut | Write-Host
    if ($LASTEXITCODE -eq 0) {
      Write-Status "Build" $true "completed"
    } else {
      Write-Status "Build" $false "failed - check $buildLogErr"
      exit 1
    }
  }
  catch {
    Write-Status "Build" $false $_.Exception.Message
    exit 1
  }
} else {
  Write-Status "Build" $true "already exists (use -SkipBuild to skip)"
}

# -- 5. Next.js production server ------------------------------------
Write-Host "[5/6] Next.js production server" -ForegroundColor Yellow

$nextBin = "$ProjectDir\node_modules\.bin\next.cmd"
if (-not (Test-Path $nextBin)) { $nextBin = "$ProjectDir\node_modules\next\dist\bin\next" }

$nextRunning = Test-Port -Port 3000
if ($nextRunning) {
  Write-Status "Next.js" $true "already running (use -Stop to restart)"
} else {
  try {
    # ── Explicitly load critical env vars from .env.production ──
    # Next.js 16+ loads .env BEFORE .env.production (stopping at first match),
    # so .env values can override .env.production. By pre-loading key vars
    # from .env.production as process env vars, they get highest priority.
    $envContent = Get-Content $EnvFile -Raw
    if ($envContent -match 'MP_ACCESS_TOKEN="?([^"\r\n]+)"?') {
      $env:MP_ACCESS_TOKEN = $matches[1]
    }
    if ($envContent -match 'MP_PUBLIC_KEY="?([^"\r\n]+)"?') {
      $env:MP_PUBLIC_KEY = $matches[1]
    }
    if ($envContent -match 'NEXT_PUBLIC_MP_PUBLIC_KEY="?([^"\r\n]+)"?') {
      $env:NEXT_PUBLIC_MP_PUBLIC_KEY = $matches[1]
    }
    Write-Status "Production env vars" $true "MP_ACCESS_TOKEN loaded (length: $($env:MP_ACCESS_TOKEN.Length))"

    $nextLogOut = "$LogDir\prd-server-out.log"
    $nextLogErr = "$LogDir\prd-server-err.log"
    $env:NODE_ENV = "production"
    $nextProc = Start-Process -FilePath $nextBin `
      -ArgumentList "start" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $nextLogOut -RedirectStandardError $nextLogErr
    Start-Sleep -Seconds 3
    if (Test-Port -Port 3000) {
      Write-Status "Next.js" $true "started (https://legendai.online)"
    } else {
      Write-Status "Next.js" $false "might still be starting - check $nextLogErr"
    }
  }
  catch {
    Write-Status "Next.js" $false $_.Exception.Message
  }
}

# -- 6. Worker ------------------------------------------------------
Write-Host "[6/6] Worker (BullMQ)" -ForegroundColor Yellow

$tsxBin = "$ProjectDir\node_modules\.bin\tsx.cmd"

try {
  $workerLogOut = "$LogDir\worker-prd-out.log"
  $workerLogErr = "$LogDir\worker-prd-err.log"
  $workerProc = Start-Process -FilePath $tsxBin `
    -ArgumentList "--env-file=`"$EnvFile`"", "src/workers/videoProcessor.ts" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $workerLogOut -RedirectStandardError $workerLogErr
  Start-Sleep -Seconds 3
  Write-Status "Worker" $true "started (logs: $LogDir\worker-prd-*.log)"
  $activePids.worker = $workerProc.Id
}
catch {
  Write-Status "Worker" $false $_.Exception.Message
}

# -- Summary --------------------------------------------------------
Write-Host "`n========== Production startup complete =============`n" -ForegroundColor Green
Write-Host "  Next.js  -> https://legendai.online (production)" -ForegroundColor Green
Write-Host "  Whisper  -> http://localhost:8000 (optional)" -ForegroundColor Green
Write-Host "  Worker   -> running in background" -ForegroundColor Green
Write-Host "  Redis    -> localhost:6379" -ForegroundColor Green
Write-Host "  Postgres -> localhost:5432" -ForegroundColor Green
Write-Host "`nUse .\start-prd.ps1 -Stop to shut everything down.`n" -ForegroundColor DarkGray