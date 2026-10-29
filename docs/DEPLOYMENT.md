# Deployment and Setup Guide

How to run PHC Voice Prescription on a development machine and on a Raspberry Pi. For what the system does and how it
works, see the [main README](../README.md).

**Contents**
[Components](#components) ·
[Local development](#local-development) ·
[Raspberry Pi deployment](#raspberry-pi-deployment) ·
[Configuration](#configuration) ·
[LLM backends and the online fallback](#llm-backends-and-the-online-fallback) ·
[Running as services](#running-as-services-optional) ·
[Benchmarking](#benchmarking) ·
[Security checklist](#security-checklist) ·
[Troubleshooting](#troubleshooting)

---

## Components

Four processes work together. All of them can run on one machine.

| Component | Default address | Provided by |
|---|---|---|
| Portal (Next.js) | `http://localhost:3000` | this repository (`pnpm dev` or `pnpm start`) |
| MongoDB | `mongodb://localhost:27017` | Docker image or a system install |
| Whisper service (speech-to-text) | `http://localhost:8080` | [`scripts/whisper_server.py`](../scripts/whisper_server.py) |
| Ollama (local LLM, optional) | `http://localhost:11434` | [ollama.com](https://ollama.com) |

The portal works with only MongoDB running: with `LLM_ENABLED=false` (the default) every request uses the rules engine
alone, and the transcript can be typed or captured by the browser instead of Whisper.

## Local development

Prerequisites: Node.js 24, [pnpm](https://pnpm.io), and Docker (for MongoDB).

```bash
git clone https://github.com/LegitCoconut/ai-medical-documentation.git
cd ai-medical-documentation

# MongoDB
docker start phc-mongo || docker run -d --name phc-mongo -p 27017:27017 -v phc-mongo-data:/data/db mongo:7

pnpm install
cp .env.example .env.local
pnpm seed        # idempotent demo accounts and patients; safe to re-run
pnpm dev         # http://localhost:3000
```

`pnpm seed:reset` clears and re-creates the demo data.

**Demo logins** (created by `pnpm seed`; change or remove them for any real use):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Reception | `reception` | `recep123` |
| Doctor | `dr.rao` | `doctor123` |

Useful commands:

```bash
pnpm test:extract   # 23 assertions over the extraction rules
pnpm eval:extract   # labelled field-accuracy and latency script
pnpm check:llm      # connectivity check for the configured LLM backend
pnpm lint
```

## Raspberry Pi deployment

### What you need

- A Raspberry Pi running a **64-bit** OS (Raspberry Pi OS or Debian). The scripts check for `aarch64`.
- 8 GB of RAM is recommended; the default model also fits on 4 GB boards.
- Internet access **during setup only**, to download the models. After that the system can run fully offline.
- A USB microphone (a clip-on or collar microphone worn by the doctor works best) and, optionally, a display and a
  footswitch.

### One-shot setup

[`scripts/setup-pi.sh`](../scripts/setup-pi.sh) installs the system packages, Ollama and the models, builds the
Whisper environment, and writes `.env.local`:

```bash
git clone https://github.com/LegitCoconut/ai-medical-documentation.git
cd ai-medical-documentation
bash scripts/setup-pi.sh
```

It will:

1. install `curl`, `ffmpeg`, Python 3 and the venv tools with `apt`;
2. install Ollama (if missing), enable its service, and pull the model (`qwen2.5:1.5b` by default);
3. create `.venv-whisper/`, install faster-whisper, and download the Whisper model (`base` by default);
4. create or update `.env.local` with the LLM and Whisper settings;
5. optionally ask for an online fallback API key (press Enter to skip).

Override the defaults with environment variables:

```bash
OLLAMA_MODEL=qwen2.5:3b WHISPER_MODEL=small bash scripts/setup-pi.sh
```

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | `qwen2.5:3b` is better on an 8 GB board but slower |
| `WHISPER_MODEL` | `base` | `tiny` is fastest, `small` is more accurate but slower |
| `FALLBACK_API_KEY` | (ask) | enables the online fallback |
| `FALLBACK_MODEL` | `anthropic/claude-haiku-4.5` | model name at your gateway; check that your gateway offers it |
| `FALLBACK_BASE_URL` | `https://ai-gateway.vercel.sh/v1` | any OpenAI-compatible endpoint |

> `setup-pi.sh` does **not** install MongoDB. See the next section.

### MongoDB on the Pi

Run MongoDB the same way as in development (Docker), or install a MongoDB build for arm64. MongoDB 5.0 and later need
a CPU with ARMv8.2-A, which excludes the Raspberry Pi 4 and earlier; a Raspberry Pi 5 is fine.

```bash
docker run -d --name phc-mongo --restart unless-stopped -p 27017:27017 -v phc-mongo-data:/data/db mongo:7
```

### Step-by-step alternative

If you prefer to run the steps yourself, or Ollama is already installed:

```bash
# Whisper only: venv, faster-whisper, and the base model download
bash scripts/install-whisper.sh                # WHISPER_MODEL=small to change the model

# Ollama: confirm the service is up, then pull a model
systemctl status ollama
ollama pull qwen2.5:1.5b
curl http://localhost:11434/api/tags
```

Ollama's Linux installer registers a systemd service that listens on `127.0.0.1:11434`. To make it reachable from other
machines, run `sudo systemctl edit ollama`, add

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=30m"
```

and `sudo systemctl restart ollama`. Ollama has **no authentication**, so only do this on a trusted network.
`OLLAMA_KEEP_ALIVE` keeps the model loaded, which avoids a slow first reply after idle periods.

### Start the Whisper service

[`scripts/run-whisper.sh`](../scripts/run-whisper.sh) serves Whisper on `127.0.0.1:8080` (localhost only):

```bash
bash scripts/run-whisper.sh                    # same WHISPER_MODEL as you installed
```

Check it from another terminal:

```bash
curl http://localhost:8080/health              # {"status": "ok", "model": "base"}
```

The model and port can be changed with `WHISPER_MODEL` and `WHISPER_PORT`. If you install with one model and run with
another, the run step will try to download the second model.

### Build and run the portal

```bash
pnpm install
pnpm seed
pnpm build
pnpm start                                     # http://localhost:3000
```

On the Pi's own display you can open the portal in a browser in kiosk mode, for example
`chromium --kiosk http://localhost:3000`. Other machines on the same network can use `http://<pi-address>:3000`.

### Verify

```bash
pnpm check:llm                                 # LLM backend reachable?
curl http://localhost:8080/health              # Whisper up?
```

Then sign in as a doctor, open a visit, type or dictate a short consultation and press **Create prescription**.

### Running fully offline

After setup, nothing needs the internet. If the Whisper model was downloaded (check with
`ls ~/.cache/huggingface/hub | grep faster-whisper`), you can stop the Pi from trying to reach Hugging Face by setting
`HF_HUB_OFFLINE=1` in the environment of the Whisper service. Leave `LLM_FALLBACK_API_KEY` unset so that no transcript
text can leave the device.

## Configuration

Settings live in `.env.local` (copy from [`.env.example`](../.env.example)).

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | database connection (default `mongodb://localhost:27017`, database `phc`) |
| `AUTH_SECRET` | signs session tokens; **set a long random value** |
| `LLM_ENABLED` | `true` turns on the LLM leg; `false` (default) uses rules only |
| `LLM_BASE_URL` | OpenAI-compatible endpoint; default `http://localhost:11434/v1` (Ollama) |
| `LLM_MODEL` | model name, for example `qwen2.5:1.5b` |
| `LLM_PROVIDER` | `ollama` or `openai`; detected automatically if unset |
| `LLM_API_KEY` | key for a hosted gateway (not needed for Ollama) |
| `LLM_FALLBACK_API_KEY`, `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_MODEL` | online fallback; used only if the key and model are both set |
| `WHISPER_BASE_URL` | Whisper service, default `http://localhost:8080` |
| `WHISPER_MODEL`, `WHISPER_API_KEY` | model name and optional key sent to the Whisper service |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`, `APPOINTMENT_LINK_SECRET` | optional: email links to the queue-status page |

Whisper service tuning (environment of `whisper_server.py`): `WHISPER_HOST`, `WHISPER_PORT`, `WHISPER_DEVICE`
(`cpu`), `WHISPER_COMPUTE_TYPE` (`int8`) and `WHISPER_LANGUAGE` (`en`).

## LLM backends and the online fallback

The LLM leg is optional. The primary backend is whatever `LLM_BASE_URL` and `LLM_MODEL` point to, normally the local
Ollama server. For each request the portal tries backends in order:

1. the **primary** backend (local Ollama);
2. the **online fallback**, only if `LLM_FALLBACK_API_KEY` and `LLM_FALLBACK_MODEL` are set;
3. if both fail, the **rules-only** draft is kept and a warning is logged. The consultation is never blocked.

A backend counts as failed on a timeout (60 s for structuring), a network error, or a non-200 status.

```
LLM_FALLBACK_API_KEY=...
LLM_FALLBACK_BASE_URL=https://ai-gateway.vercel.sh/v1
LLM_FALLBACK_MODEL=anthropic/claude-haiku-4.5
```

> **Privacy.** The fallback sends the consultation **transcript text** (never audio) to a third party. Keep it disabled
> unless patients have consented and your data-protection rules allow it.

To use a hosted model as the primary backend instead of Ollama, set `LLM_ENABLED=true`, `LLM_PROVIDER=openai`,
`LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`; `pnpm dev:llm -- <provider/model>` is a shortcut for development.

## Running as services (optional)

These unit files are examples; adapt the paths and user, and test them before relying on them. Create them with
`sudo nano /etc/systemd/system/<name>.service`, then `sudo systemctl daemon-reload && sudo systemctl enable --now <name>`.

`phc-whisper.service`

```ini
[Unit]
Description=PHC Whisper speech-to-text service
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/ai-medical-documentation
ExecStart=/bin/bash scripts/run-whisper.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`phc-portal.service` (run `pnpm build` first)

```ini
[Unit]
Description=PHC portal
After=network.target phc-whisper.service

[Service]
User=pi
WorkingDirectory=/home/pi/ai-medical-documentation
ExecStart=/usr/bin/env pnpm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

If `pnpm` is not on the service's `PATH`, use the full path to it in `ExecStart`.

## Benchmarking

[`scripts/bench_pi.py`](../scripts/bench_pi.py) times the running services on the device: Whisper real-time factor on a
sample recording, Ollama generation speed on a structuring prompt, and memory in use. Both services must already be
running.

```bash
python3 scripts/bench_pi.py sample.wav qwen2.5:1.5b
```

It prints the Whisper RTF (processing time divided by audio length), tokens per second for generation and for the
prompt, RAM in use, and the CPU temperature when `vcgencmd` is available. The rules-engine numbers come from
`pnpm eval:extract`.

## Security checklist

- Change or delete the **demo accounts** and set a long random `AUTH_SECRET` before any real use.
- Keep Ollama and the Whisper service on `127.0.0.1` unless you need them elsewhere; neither has authentication.
- Leave the online fallback **disabled** unless you have consent to send transcript text off the device.
- Treat the Pi's disk as sensitive: it holds the patient database.
- This is a research prototype and **not a medical device**; do not use it for real patient care without clinical
  validation.

## Troubleshooting

**`Name or service not known` while downloading the Whisper model.** The Pi cannot resolve `huggingface.co`, so there is
no working DNS or internet at that moment. Check `ping -c1 huggingface.co`, then `cat /etc/resolv.conf` and
`ping -c1 8.8.8.8`. If the IP works but the name does not, fix DNS (for example
`sudo resolvectl dns eth0 1.1.1.1 8.8.8.8`, using your interface name), then re-run `bash scripts/install-whisper.sh`;
it is safe to re-run.

**Is the Whisper model downloaded?** Run `ls ~/.cache/huggingface/hub | grep faster-whisper`. You should see
`models--Systran--faster-whisper-base` (or the model you chose). Other folders in that cache belong to other tools.

**`Run scripts/install-whisper.sh first`.** `scripts/run-whisper.sh` could not find `.venv-whisper/`; run the install
script from the repository root.

**Login or pages return 500 after MongoDB was restarted.** The dev server can keep a failed database connection.
Restart `pnpm dev` (or `pnpm start`) once MongoDB is up.

**The first LLM reply is very slow.** Ollama is loading the model into memory. Set `OLLAMA_KEEP_ALIVE=30m` as shown
above, or use a smaller model.

**Structuring falls back to rules only.** Check `pnpm check:llm`, that `LLM_ENABLED=true`, and that `LLM_MODEL`
matches a name in `ollama list`. Warnings from the failed request are printed in the portal's log.

**Dose or frequency is left blank for loosely worded dictation.** That is the rules engine being cautious: it never
guesses. Enable the LLM leg, or complete the field by hand; see the failure analysis in the [README](../README.md#results).
