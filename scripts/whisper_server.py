#!/usr/bin/env python3
"""Minimal OpenAI/whisper.cpp-compatible STT server using faster-whisper.

Run:
    WHISPER_MODEL=base python3 scripts/whisper_server.py
Listens on 0.0.0.0:8080 by default. Exposes /inference (whisper.cpp) and
/v1/audio/transcriptions (OpenAI-compatible) and returns JSON { "text": "..." }.
"""

import io
import json

# Compatibility patch: some av versions do not accept `metadata_errors`.
try:
    import av
    _av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop('metadata_errors', None)
        return _av_open(*args, **kwargs)
    av.open = _patched_av_open
except ImportError:
    pass
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
HOST = os.environ.get("WHISPER_HOST", "0.0.0.0")
PORT = int(os.environ.get("WHISPER_PORT", "8080"))

_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(MODEL_SIZE, device=os.environ.get("WHISPER_DEVICE", "cpu"),
                             compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"))
    return _model


def transcribe_bytes(data: bytes, filename: str = "audio.webm") -> str:
    src_fd, src_path = tempfile.mkstemp(suffix=os.path.splitext(filename)[1] or ".webm")
    os.close(src_fd)
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    try:
        with open(src_path, "wb") as f:
            f.write(data)
        # Normalize to 16kHz mono wav; ffmpeg is required and already present on most dev machines.
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
            # Fall back to letting faster-whisper read the original container.
            wav_path = src_path
        segments, _info = get_model().transcribe(wav_path, language=os.environ.get("WHISPER_LANGUAGE", "en"))
        return " ".join(s.text.strip() for s in segments).strip()
    finally:
        for p in (src_path, wav_path):
            try:
                os.unlink(p)
            except OSError:
                pass


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json(self, status: int, payload: dict):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path in ("/", "/health"):
            self._send_json(200, {"status": "ok", "model": MODEL_SIZE})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in ("/inference", "/v1/audio/transcriptions"):
            self._send_json(404, {"error": "not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "bad content length"})
            return
        if content_length <= 0:
            self._send_json(400, {"error": "empty body"})
            return
        body = self.rfile.read(content_length)

        ctype = self.headers.get("Content-Type", "")
        audio_bytes = None
        filename = "audio.webm"
        if "multipart/form-data" in ctype:
            # Parse multipart body manually to avoid deprecated cgi helpers.
            boundary_key = "boundary="
            idx = ctype.find(boundary_key)
            if idx < 0:
                self._send_json(400, {"error": "missing multipart boundary"})
                return
            boundary = ctype[idx + len(boundary_key):].strip().strip('"')
            delim = ("--" + boundary).encode()
            for part in body.split(delim):
                if not part or part in (b"--", b"--\r\n", b"--\n"):
                    continue
                if part.startswith(b"\r\n"):
                    part = part[2:]
                if part.endswith(b"\r\n"):
                    part = part[:-2]
                if b"\r\n\r\n" not in part:
                    continue
                head, data = part.split(b"\r\n\r\n", 1)
                headers = {}
                for line in head.decode("latin-1").split("\r\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        headers[k.strip().lower()] = v.strip()
                disp = headers.get("content-disposition", "")
                if 'name="file"' in disp or "name='file'" in disp or 'name="audio"' in disp or "name='audio'" in disp:
                    audio_bytes = data
                    # Best-effort filename extraction.
                    if 'filename="' in disp:
                        fn_start = disp.find('filename="') + len('filename="')
                        fn_end = disp.find('"', fn_start)
                        if fn_end > fn_start:
                            filename = disp[fn_start:fn_end] or filename
                    break
        else:
            audio_bytes = body

        if not audio_bytes:
            self._send_json(400, {"error": "no audio file found (field 'file'/'audio')"})
            return

        # Lazy import so the server can at least report health/config errors clearly.
        try:
            text = transcribe_bytes(audio_bytes, filename)
        except Exception as exc:
            self._send_json(500, {"error": f"transcription failed: {exc}"})
            return
        self._send_json(200, {"text": text})

    def log_message(self, fmt, *args):
        print(f"[whisper] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    print(f"[whisper] loading model '{MODEL_SIZE}' on {HOST}:{PORT}")
    try:
        get_model()
    except Exception as exc:
        print(f"[whisper] WARNING: model pre-load failed: {exc}")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[whisper] serving on http://{HOST}:{PORT}")
    httpd.serve_forever()
