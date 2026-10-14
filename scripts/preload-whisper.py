#!/usr/bin/env python3
"""Preload a Whisper model into memory using faster-whisper.

Usage:
    WHISPER_MODEL=medium python3 scripts/preload-whisper.py

Environment variables:
    WHISPER_MODEL         Model size, e.g. tiny/base/small/medium/large-v3 (default: medium)
    WHISPER_DEVICE        cpu or cuda (default: cpu)
    WHISPER_COMPUTE_TYPE  int8 / float16 / float32 (default: int8)
    WHISPER_LANGUAGE      Default transcription language (default: en)
"""

import os

from faster_whisper import WhisperModel


def main() -> None:
    model_name = os.environ.get("WHISPER_MODEL", "medium")
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

    print(f"Loading Whisper model '{model_name}' on {device} ({compute_type})...")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    # Keeping a reference prevents the model from being collected early.
    globals()["_model"] = model

    print("Whisper model is loaded into memory and ready.")
    print("Model:", model_name)
    print("Press Ctrl+C to stop and unload the model.")

    try:
        while True:
            import time
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\nUnloading Whisper model.")


if __name__ == "__main__":
    main()