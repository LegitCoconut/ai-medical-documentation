#!/usr/bin/env bash
# Run the Whisper STT server on http://127.0.0.1:8080 (localhost only).
# Usage: bash scripts/run-whisper.sh   (WHISPER_MODEL / WHISPER_PORT to override)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -x .venv-whisper/bin/python ] || { echo "Run scripts/install-whisper.sh first" >&2; exit 1; }

export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_HOST=127.0.0.1
export WHISPER_PORT="${WHISPER_PORT:-8080}"
export WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8
exec .venv-whisper/bin/python scripts/whisper_server.py
