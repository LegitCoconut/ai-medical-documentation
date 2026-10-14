#!/usr/bin/env node
// Quick connectivity check for the configured LLM backend.
// Usage:
//   node --env-file=.env.local scripts/check-llm.mjs
// or with overrides:
//   LLM_MODEL=anthropic/claude-sonnet-4.5 LLM_API_KEY=... node scripts/check-llm.mjs

const base = (process.env.LLM_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, '')
const model = process.env.LLM_MODEL
const key = (process.env.LLM_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim()

if (!model) {
  console.error('LLM_MODEL is not set')
  process.exit(1)
}

console.log('Base URL :', base)
console.log('Model    :', model)
console.log('API key  :', key ? 'set' : '(none)')

const headers = { 'Content-Type': 'application/json' }
if (key) headers['Authorization'] = `Bearer ${key}`

const body = {
  model,
  stream: false,
  temperature: 0,
  messages: [
    { role: 'system', content: 'Reply with the single word: OK' },
    { role: 'user', content: 'Ping' },
  ],
}

const t0 = Date.now()
let res
try {
  res = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
} catch (err) {
  console.error('Request failed:', err.message)
  process.exit(1)
}
const ms = Date.now() - t0
console.log('HTTP status:', res.status, `(${ms}ms)`)

const text = await res.text()
if (!res.ok) {
  console.error('Response:', text.slice(0, 500))
  process.exit(1)
}
let json
try { json = JSON.parse(text) } catch {
  console.error('Non-JSON response:', text.slice(0, 500))
  process.exit(1)
}
const content = json?.choices?.[0]?.message?.content
console.log('Model reply:', content)
console.log('OK')