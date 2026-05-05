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
$LogDir     = "$ProjectDir\logs"

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
      Kills ALL Node.js processes from the current project (next dev, tsx workers, postcss watchers)
      using WMI/CIM to check command lines. Works in PowerShell 5.1.
  #>
  $projectPath = $ProjectDir.Replace('\', '\\')
  $nodeProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  $toKill = $nodeProcs | Where-Object {
    $cmd = $_.CommandLine
    $cmd -match $projectPath -and
    $cmd -match "(next|tsx|postcss|turbopack|worker)" -and
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
#  Stop-DevServices - clean shutdown
# ===================================================================
function Stop-DevServices {
  Write-Host "`nShutting down LegendaAI services..." -ForegroundColor Magenta

  # Kill ALL project Node processes by command line (catches orphans that PID tracking misses)
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

  # OpenCode (port 4096)
  if (Test-Port -Port 4096) {
    try {
      $p = Get-NetTCPConnection -LocalPort 4096 -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($p -and $p.OwningProcess) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Status "OpenCode" $true "stopped"
      }
    } catch {
      Write-Status "OpenCode" $false "could not stop"
    }
  } else {
    Write-Status "OpenCode" $true "not running"
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
  @(3000, 4096, 8000) | ForEach-Object {
    $port = $_
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Status "Port $port" $true "force killed"
    }
  }

  Write-Host "`nAll services stopped.`n" -ForegroundColor Magenta
}

if ($Stop) {
  Stop-DevServices
  exit 0
}

# -- Pre-start cleanup: kill orphans before starting fresh ----------
Write-Host "`nCleaning up orphaned processes from previous runs..." -ForegroundColor DarkGray
Kill-ProjectNodeProcesses

Write-Host "`n========== LegendaAI - Development Startup ==========`n" -ForegroundColor Cyan

$activePids = @{}
# Clean up old PID file — stop now uses port-based detection instead
Remove-TrackedPids

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
    $opencodeLogOut = "$LogDir\opencode-out.log"
    $opencodeLogErr = "$LogDir\opencode-err.log"
    $opencodeProc = Start-Process -FilePath "cmd.exe" `
      -ArgumentList "/c", "npx opencode serve --port 4096" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $opencodeLogOut -RedirectStandardError $opencodeLogErr
    Start-Sleep -Seconds 8
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

$nextBin = "$ProjectDir\node_modules\.bin\next.cmd"
if (-not (Test-Path $nextBin)) { $nextBin = "$ProjectDir\node_modules\next\dist\bin\next" }

$nextRunning = Test-Port -Port 3000
if ($nextRunning) {
  Write-Status "Next.js" $true "already running (use -Stop to restart)"
} else {
  try {
    $nextLogOut = "$LogDir\dev-server-out.log"
    $nextLogErr = "$LogDir\dev-server-err.log"
    $nextProc = Start-Process -FilePath $nextBin `
      -ArgumentList "dev" `
      -WorkingDirectory $ProjectDir `
      -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $nextLogOut -RedirectStandardError $nextLogErr
    Start-Sleep -Seconds 3
    if (Test-Port -Port 3000) {
      Write-Status "Next.js" $true "started (http://localhost:3000)"
    } else {
      Write-Status "Next.js" $false "might still be starting — check $nextLogErr"
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
  $workerLogOut = "$LogDir\worker-out.log"
  $workerLogErr = "$LogDir\worker-err.log"
  $envFile = "$ProjectDir\.env.local"
  $workerProc = Start-Process -FilePath $tsxBin `
    -ArgumentList "--env-file=`"$envFile`"", "--watch", "src/workers/videoProcessor.ts" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $workerLogOut -RedirectStandardError $workerLogErr
  Start-Sleep -Seconds 3
  Write-Status "Worker" $true "started (logs: $LogDir\worker-*.log)"
}
catch {
  Write-Status "Worker" $false $_.Exception.Message
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
