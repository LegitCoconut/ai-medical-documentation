#!/usr/bin/env python3
"""Measure Whisper RTF and Ollama speed on the device (servers must already be running).

Usage: python3 scripts/bench_pi.py sample.wav [ollama-model]   (WHISPER_URL / OLLAMA_URL to override)
"""
import json, os, shutil, subprocess, sys, time, urllib.request, wave

wav = sys.argv[1]
model = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("LLM_MODEL", "qwen2.5:1.5b")
whisper = os.environ.get("WHISPER_URL", "http://localhost:8080") + "/inference"
ollama = os.environ.get("OLLAMA_URL", "http://localhost:11434") + "/api/generate"
PROMPT = ("Convert to JSON {vitals, diagnosis, prescription}: Patient complains of fever and cough since "
          "three days. Chest is clear. BP 120 over 80. Tab Paracetamol 650 mg TDS for 3 days after food.")


def mem_used_mb():
    f = dict(l.split(":") for l in open("/proc/meminfo"))
    return (int(f["MemTotal"].split()[0]) - int(f["MemAvailable"].split()[0])) // 1024


def post(url, data, ctype):
    req = urllib.request.Request(url, data=data, headers={"Content-Type": ctype})
    return json.load(urllib.request.urlopen(req, timeout=600))


with wave.open(wav) as w:
    dur = w.getnframes() / w.getframerate()
raw = open(wav, "rb").read()
post(whisper, raw, "audio/wav")  # warm-up (loads model)
t = time.time(); text = post(whisper, raw, "audio/wav")["text"]; ts = time.time() - t
print(f"whisper: audio {dur:.1f}s, processing {ts:.2f}s, RTF {ts / dur:.2f}\n  text: {text[:120]}")

post(ollama, json.dumps({"model": model, "prompt": "hi", "stream": False}).encode(), "application/json")  # warm-up
r = post(ollama, json.dumps({"model": model, "prompt": PROMPT, "stream": False}).encode(), "application/json")
print(f"ollama {model}: {r['eval_count'] / (r['eval_duration'] / 1e9):.1f} tok/s generation, "
      f"{r['prompt_eval_count'] / (r['prompt_eval_duration'] / 1e9):.0f} tok/s prompt, total {r['total_duration'] / 1e9:.1f}s")
print(f"RAM in use: {mem_used_mb()} MB")
if shutil.which("vcgencmd"):
    print(subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True).stdout.strip())
