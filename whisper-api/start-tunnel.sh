#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# Expose the local Whisper API via Cloudflare Tunnel (cloudflared).
# Prints the public URL on startup.  Press Ctrl+C to stop.
# ------------------------------------------------------------------

if ! command -v cloudflared &>/dev/null; then
    echo "ERROR: cloudflared is not installed." >&2
    echo ""
    echo "Install it via one of the following methods:"
    echo ""
    echo "  Linux (amd64):"
    echo "    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
    echo "    chmod +x cloudflared"
    echo "    sudo mv cloudflared /usr/local/bin/"
    echo ""
    echo "  macOS:"
    echo "    brew install cloudflared"
    echo ""
    echo "  Windows:"
    echo "    scoop install cloudflared"
    echo "    (or use start-tunnel.ps1)"
    echo ""
    exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Starting Cloudflare Tunnel to localhost:8000   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

exec cloudflared tunnel --url http://localhost:8000
