#!/usr/bin/env bash
# Raspberry Pi (64-bit Raspberry Pi OS / Debian) setup: Ollama model + Whisper STT + .env.local.
# Usage:  bash scripts/setup-pi.sh
# Optional env: OLLAMA_MODEL (default qwen2.5:1.5b), WHISPER_MODEL (default base),
#               FALLBACK_API_KEY / FALLBACK_MODEL / FALLBACK_BASE_URL for the online backup LLM.
set -euo pipefail
cd "$(dirname "$0")/.."

OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"   # 3b is OK on a Pi 5 with 8GB
WHISPER_MODEL="${WHISPER_MODEL:-base}"         # tiny = fastest, small = best accuracy
VENV="$PWD/.venv-whisper"

[ "$(uname -m)" = "aarch64" ] || echo "warning: not a 64-bit ARM OS (got $(uname -m)); Ollama needs arm64"

echo "==> System packages"
sudo apt-get update
sudo apt-get install -y curl ffmpeg python3 python3-venv python3-pip

echo "==> Ollama"
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama 2>/dev/null || true
for _ in $(seq 30); do curl -fs localhost:11434 >/dev/null && break; sleep 1; done
ollama pull "$OLLAMA_MODEL"

echo "==> Whisper (faster-whisper, int8 on CPU)"
[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip faster-whisper
WHISPER_MODEL="$WHISPER_MODEL" "$VENV/bin/python" -c \
  "import os; from faster_whisper import WhisperModel; WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8'); print('whisper model ready')"

echo "==> .env.local"
[ -f .env.local ] || cp .env.example .env.local
setenv() { # setenv KEY VALUE: replace or append
  if grep -q "^$1=" .env.local; then sed -i "s|^$1=.*|$1=$2|" .env.local; else echo "$1=$2" >> .env.local; fi
}
setenv LLM_ENABLED true
setenv LLM_BASE_URL http://localhost:11434/v1
setenv LLM_MODEL "$OLLAMA_MODEL"
setenv WHISPER_BASE_URL http://localhost:8080
setenv WHISPER_MODEL "$WHISPER_MODEL"

if [ -z "${FALLBACK_API_KEY:-}" ] && ! grep -q "^LLM_FALLBACK_API_KEY=." .env.local; then
  read -rp "Online fallback API key (Vercel AI Gateway; Enter to skip): " FALLBACK_API_KEY || true
fi
if [ -n "${FALLBACK_API_KEY:-}" ]; then
  setenv LLM_FALLBACK_API_KEY "$FALLBACK_API_KEY"
  setenv LLM_FALLBACK_BASE_URL "${FALLBACK_BASE_URL:-https://ai-gateway.vercel.sh/v1}"
  setenv LLM_FALLBACK_MODEL "${FALLBACK_MODEL:-anthropic/claude-haiku-4.5}"
fi

cat <<EOT

Done. Start Whisper in one terminal:
  WHISPER_MODEL=$WHISPER_MODEL $VENV/bin/python scripts/whisper_server.py
and the app in another:
  pnpm build && pnpm start
EOT
