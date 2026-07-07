#!/bin/bash
# Chronicle Electron Dev — WSL side
#
# Starts Vite dev server in WSL, then launches native Windows Electron.
# The Electron window runs natively on Windows, loading content from WSL Vite.
#
# Usage (from WSL):
#   bash packages/manager/electron-dev-wsl.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANAGER_DIR="$SCRIPT_DIR/packages/manager"
VITE_PORT="${1:-5173}"

echo "=== Chronicle Electron Hybrid Dev ==="
echo ""

# ── Kill any existing vite on this port ──
echo "[1/3] Cleaning up old Vite..."
lsof -ti :$VITE_PORT 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# ── Start Vite in background ──
echo "[2/3] Starting Vite dev server..."
cd "$MANAGER_DIR"
ELECTRON=true npx vite --host 0.0.0.0 --port $VITE_PORT &
VITE_PID=$!
echo "  Vite PID: $VITE_PID"

# Wait for Vite ready
for i in $(seq 1 15); do
  if curl -sf -o /dev/null "http://localhost:$VITE_PORT" 2>/dev/null; then
    echo "  Vite ready at http://localhost:$VITE_PORT"
    break
  fi
  sleep 1
  echo "  Waiting... ($i/15)"
done

# ── Launch Windows Electron ──
echo "[3/3] Launching Windows Electron..."
echo "  (Electron window will appear on Windows — keep WSL terminal open)"
echo "  Press Ctrl+C to stop both Vite and Electron."

# This runs the PowerShell script on Windows side
powershell.exe -ExecutionPolicy Bypass -File "$MANAGER_DIR/electron-dev.ps1" -VitePort $VITE_PORT

# ── Cleanup ──
echo ""
echo "Shutting down Vite..."
kill $VITE_PID 2>/dev/null || true
echo "Done."
