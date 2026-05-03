<#
.SYNOPSIS
    Expose the local Whisper API via Cloudflare Tunnel.
.DESCRIPTION
    Starts a cloudflared tunnel to localhost:8000 so the Whisper API
    is accessible from the internet. Prints the public URL on startup.
    Press Ctrl+C to stop the tunnel.
#>

$cloudflared = Get-Command "cloudflared" -ErrorAction SilentlyContinue

if (-not $cloudflared) {
    Write-Host "ERROR: cloudflared is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it via one of the following methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Windows (scoop):" -ForegroundColor Cyan
    Write-Host "    scoop install cloudflared"
    Write-Host ""
    Write-Host "  Windows (manual):" -ForegroundColor Cyan
    Write-Host "    1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Write-Host "    2. Place cloudflared.exe somewhere in your PATH"
    Write-Host ""
    Write-Host "  Linux (amd64):" -ForegroundColor Cyan
    Write-Host "    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
    Write-Host "    chmod +x cloudflared"
    Write-Host "    sudo mv cloudflared /usr/local/bin/"
    Write-Host ""
    Write-Host "  macOS:" -ForegroundColor Cyan
    Write-Host "    brew install cloudflared"
    Write-Host ""
    exit 1
}

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Starting Cloudflare Tunnel to localhost:8000   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Start the tunnel – cloudflared prints the URL on stdout
try {
    cloudflared tunnel --url http://localhost:8000
} catch {
    Write-Host "Tunnel exited with error: $_" -ForegroundColor Red
    exit 1
}
