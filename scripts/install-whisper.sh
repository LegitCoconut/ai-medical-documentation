#!/usr/bin/env bash
# Install faster-whisper into ./.venv-whisper and download the "base" model.
# Usage: bash scripts/install-whisper.sh   (WHISPER_MODEL=small to override)
set -euo pipefail
cd "$(dirname "$0")/.."

export WHISPER_MODEL="${WHISPER_MODEL:-base}"
VENV="$PWD/.venv-whisper"

sudo apt-get update
sudo apt-get install -y ffmpeg python3 python3-venv python3-pip

[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip faster-whisper

# Constructing the model downloads it into the Hugging Face cache.
"$VENV/bin/python" -c "
import os
from faster_whisper import WhisperModel
WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8')
print('whisper model ready:', os.environ['WHISPER_MODEL'])"
