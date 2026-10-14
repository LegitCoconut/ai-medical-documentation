import { guard, jsonError } from '@/lib/auth'

/**
 * POST /api/transcribe
 * Accepts a multipart/form-data body with a single "audio" file field.
 * Forwards the file to the Whisper-compatible HTTP server (WHISPER_BASE_URL)
 * and returns { text: string }.
 *
 * Compatible with:
 *  - whisper.cpp HTTP server  (POST /inference, field name "file")
 *  - OpenAI-compatible servers (POST /v1/audio/transcriptions, field name "file")
 *
 * Set WHISPER_BASE_URL in .env.local:
 *   WHISPER_BASE_URL=http://localhost:8080          (whisper.cpp)
 *   WHISPER_BASE_URL=http://localhost:11434/v1      (ollama with audio, or any OAI-compat)
 */

function whisperBaseUrl(): string {
  return (process.env.WHISPER_BASE_URL || '').replace(/\/$/, '')
}

function whisperEnabled(): boolean {
  return !!whisperBaseUrl()
}

export async function POST(req: Request) {
  return guard(['doctor'], async () => {
    if (!whisperEnabled()) {
      throw jsonError('Whisper STT is not configured (WHISPER_BASE_URL not set)', 503)
    }

    // The client sends a FormData with a single "audio" blob.
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw jsonError('Expected multipart/form-data body', 400)
    }

    const audioFile = form.get('audio')
    if (!(audioFile instanceof Blob)) {
      throw jsonError('Missing "audio" field in form data', 400)
    }

    const baseUrl = whisperBaseUrl()

    // Optional bearer token for hosted/OpenAI-compatible transcription endpoints.
    const whisperKey = (process.env.WHISPER_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim()
    const upstreamHeaders: Record<string, string> = {}
    if (whisperKey) upstreamHeaders['Authorization'] = `Bearer ${whisperKey}`

    // Determine endpoint style:
    // whisper.cpp server uses POST /inference
    // OpenAI-compatible servers use POST /v1/audio/transcriptions
    const isOai = baseUrl.includes('/v1')
    const endpoint = isOai
      ? `${baseUrl}/audio/transcriptions`
      : `${baseUrl}/inference`

    const outForm = new FormData()
    outForm.append('file', audioFile, 'audio.webm')

    if (isOai) {
      // OpenAI-compatible: requires model field
      const model = process.env.WHISPER_MODEL || 'whisper-1'
      outForm.append('model', model)
      outForm.append('language', 'en')
      outForm.append('response_format', 'json')
    }
    // whisper.cpp server auto-detects; no extra fields needed.

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: upstreamHeaders,
        body: outForm,
        signal: AbortSignal.timeout(120_000), // 2 min for longer recordings
      })
    } catch (err) {
      console.error('transcribe: upstream request failed', err)
      throw jsonError('Whisper service unreachable', 502)
    }

    if (!upstreamRes.ok) {
      const errBody = await upstreamRes.text().catch(() => '')
      console.error('transcribe: upstream error', upstreamRes.status, errBody)
      throw jsonError(`Whisper service returned ${upstreamRes.status}`, 502)
    }

    let upstreamJson: unknown
    try {
      upstreamJson = await upstreamRes.json()
    } catch {
      throw jsonError('Whisper service returned non-JSON response', 502)
    }

    // whisper.cpp returns { text: "..." }
    // OpenAI-compat returns { text: "..." }
    // Both have the same shape — convenient.
    const text = (upstreamJson as { text?: string })?.text ?? ''
    return { text: text.trim() }
  })
}
