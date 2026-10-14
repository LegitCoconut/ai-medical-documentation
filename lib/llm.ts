import { matchDrug } from './drugs'
import type { DiagnosisItem, PrescriptionItem, Vitals } from './types'

export function llmEnabled(): boolean {
  return process.env.LLM_ENABLED === 'true'
}

// ---------------------------------------------------------------------------
// Unified config for any OpenAI-compatible backend: local Ollama OR a
// hosted gateway such as Vercel AI Gateway (https://ai-gateway.vercel.sh/v1).
// Switching is purely via environment variables — no code changes needed.
// ---------------------------------------------------------------------------

export function llmApiKey(): string {
  return (
    process.env.LLM_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    ''
  ).trim()
}

export function llmBaseUrl(): string {
  return (process.env.LLM_BASE_URL || 'http://localhost:11434/v1').trim()
}

export function llmModel(): string {
  return (process.env.LLM_MODEL || '').trim()
}

/** 'ollama' sends the Ollama-native `format` field; 'openai' speaks pure OpenAI. */
export function llmProvider(): 'ollama' | 'openai' {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase().trim()
  if (explicit === 'ollama') return 'ollama'
  if (explicit === 'openai' || explicit === 'gateway' || explicit === 'vercel') return 'openai'

  const key = llmApiKey()
  if (key) return 'openai' // a key implies a hosted gateway / OpenAI-compatible cloud

  const url = llmBaseUrl().toLowerCase()
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|11434|ollama/.test(url)) return 'ollama'
  return 'openai'
}

export function llmHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = llmApiKey()
  if (key) headers['Authorization'] = `Bearer ${key}`
  return headers
}

const CATEGORIES = new Set(['symptom', 'finding', 'vital', 'assessment', 'other'])
const VITAL_KEYS = ['bp', 'temp', 'pulse', 'weight', 'spo2'] as const

const SYSTEM_PROMPT = `You are a clinical scribe converting one doctor's spoken consultation transcript into structured visit data.

Rules:
- Output only what the doctor actually said. Never infer a finding they did not state.
- Never invent a dose, frequency, or duration — if the doctor did not say it, use an empty string.
- If the doctor corrected themselves later in the transcript (a restated dose, a changed drug), keep ONLY the final corrected value for that item — do not emit both.
- Drug names must be generic names, not brand names.
- Normalise frequency to one of OD, BD, TDS, QID, HS, SOS, STAT, or a numeric pattern like 1-0-1.
- Only fill a vital field if the doctor stated a number for it; otherwise leave it as an empty string.

Respond with a single JSON object only, no prose, no markdown fences, matching:
{"vitals":{"bp":"","temp":"","pulse":"","weight":"","spo2":""},"diagnosis":[{"text":"","category":"symptom|finding|vital|assessment|other"}],"prescription":[{"drug":"","dose":"","frequency":"","duration":"","notes":""}]}

Example
TRANSCRIPT: "Patient complains of fever and cough since three days. Chest is clear on auscultation. BP is 120 over 80. Start Tab Amoxicillin 500 mg TDS for 5 days after food. Actually make that 250 mg."
{"vitals":{"bp":"120/80","temp":"","pulse":"","weight":"","spo2":""},"diagnosis":[{"text":"Patient complains of fever and cough since three days","category":"symptom"},{"text":"Chest is clear on auscultation","category":"finding"}],"prescription":[{"drug":"Amoxicillin","dose":"250 mg","frequency":"TDS","duration":"5 days","notes":"after food"}]}`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    vitals: {
      type: 'object',
      properties: Object.fromEntries(VITAL_KEYS.map((k) => [k, { type: 'string' }])),
      required: [...VITAL_KEYS],
      additionalProperties: false,
    },
    diagnosis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
        required: ['text', 'category'],
        additionalProperties: false,
      },
    },
    prescription: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          drug: { type: 'string' },
          dose: { type: 'string' },
          frequency: { type: 'string' },
          duration: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['drug', 'dose', 'frequency', 'duration', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['vitals', 'diagnosis', 'prescription'],
  additionalProperties: false,
}

type StructuredResult = {
  vitals: Partial<Vitals>
  diagnosis: { text: string; category: string }[]
  prescription: { drug: string; dose: string; frequency: string; duration: string; notes: string }[]
}

function stripFence(s: string): string {
  return s.replace(/^```json\s*|^```\s*|```\s*$/g, '').trim()
}

function parseContent(content: string): StructuredResult | null {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(stripFence(content))
  } catch {
    return null
  }

  const vitals: Partial<Vitals> = {}
  const rawVitals = obj.vitals as Record<string, unknown> | undefined
  if (rawVitals && typeof rawVitals === 'object') {
    for (const k of VITAL_KEYS) {
      const v = rawVitals[k]
      if (typeof v === 'string') vitals[k] = v
    }
  }

  const diagnosis = Array.isArray(obj.diagnosis)
    ? obj.diagnosis
        .filter((d): d is { text: unknown; category: unknown } => !!d && typeof d === 'object')
        .filter((d) => typeof d.text === 'string' && d.text.trim())
        .map((d) => ({
          text: (d.text as string).trim(),
          category: typeof d.category === 'string' && CATEGORIES.has(d.category) ? d.category : 'other',
        }))
    : []

  const prescription = Array.isArray(obj.prescription)
    ? obj.prescription
        .filter((p): p is { drug: unknown; dose: unknown; frequency: unknown; duration: unknown; notes: unknown } => !!p && typeof p === 'object')
        .filter((p) => typeof p.drug === 'string' && p.drug.trim())
        .map((p) => {
          const match = matchDrug(p.drug as string)
          const baseNotes = typeof p.notes === 'string' ? p.notes : ''
          const notes = match ? baseNotes : [baseNotes, 'unverified drug name'].filter(Boolean).join(', ')
          return {
            drug: match ? match.drug : (p.drug as string).trim(),
            dose: typeof p.dose === 'string' ? p.dose : '',
            frequency: typeof p.frequency === 'string' ? p.frequency : '',
            duration: typeof p.duration === 'string' ? p.duration : '',
            notes,
          }
        })
    : []

  return { vitals, diagnosis, prescription }
}

export async function structureTranscript(
  transcript: string,
  existing: { diagnosis: DiagnosisItem[]; prescription: PrescriptionItem[]; vitals: Vitals }
): Promise<StructuredResult | null> {
  const baseUrl = llmBaseUrl()
  const model = llmModel()
  const provider = llmProvider()
  if (!model) {
    console.warn('llm: LLM_MODEL not set')
    return null
  }
  const userMsg = `EXISTING: ${JSON.stringify({
    diagnosis: existing.diagnosis.map((d) => d.text),
    prescription: existing.prescription.map((p) => p.drug),
    vitals: existing.vitals,
  })}\nTRANSCRIPT:\n${transcript}`

  let res: Response
  try {
    const body: Record<string, unknown> = {
      model,
      stream: false,
      temperature: 0,
      // OpenAI-compatible servers (incl. Vercel AI Gateway) use response_format.
      response_format: { type: 'json_schema', json_schema: { name: 'visit_structure', schema: RESPONSE_SCHEMA, strict: true } },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
    }
    // Ollama's native `/chat/completions` compatibility layer also honours a top-level `format`.
    // Only send it to Ollama — hosted OpenAI-compatible servers reject unknown fields.
    if (provider === 'ollama') body.format = RESPONSE_SCHEMA

    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })
  } catch (err) {
    console.warn('llm: request failed', err)
    return null
  }
  if (!res.ok) {
    console.warn('llm: bad response status', res.status)
    return null
  }

  let json: { choices?: { message?: { content?: string } }[] }
  try {
    json = await res.json()
  } catch (err) {
    console.warn('llm: invalid JSON response', err)
    return null
  }
  const content = json.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    console.warn('llm: empty response content')
    return null
  }
  const result = parseContent(content)
  if (!result) console.warn('llm: failed to parse structured content')
  return result
}
