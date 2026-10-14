# PHC – AI Medical Documentation Portal

## Quick setup

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Create `.env.local` (see `.env.example`). Defaults use local Ollama + a local Whisper wrapper:

   ```bash
   cp .env.example .env.local
   ```

   Edit as needed:
   - **AI / LLM** – either run Ollama locally and pull a model, or point `LLM_BASE_URL` at the Vercel AI Gateway and set `LLM_API_KEY`:
     ```bash
     ollama serve
     ollama pull qwen2.5:3b   # or any other model; update LLM_MODEL
     ```
   - **Database** – MongoDB (default `mongodb://localhost:27017`, db `phc`) and `MONGODB_DB`.
   - **Voice / STT** – set `WHISPER_BASE_URL` (default `http://localhost:8080`) and run the wrapper:
     ```bash
     python3 -m pip install --user faster-whisper
     WHISPER_MODEL=tiny python3 scripts/whisper_server.py
     ```

3. Seed demo data

   ```bash
   pnpm seed
   ```

4. Start the app

   ```bash
   pnpm dev
   ```

   Demo logins: `admin / admin123`, `dr.rao / doctor123`, `reception / recep123`.

## Verify the AI backend

```bash
pnpm run check:llm   # or: node --env-file=.env.local scripts/check-llm.mjs
```

## Verify voice recognition (Whisper)

```bash
curl -X GET http://localhost:8080/health
# then, as a logged-in doctor:
curl -b cookies.txt -X POST http://localhost:3000/api/transcribe -F "audio=@sample.webm"
```

The UI (doctor visit screen) also has a mode switch: Whisper (server) / Browser (Web Speech API) / Typed text.
