#!/usr/bin/env node
// Run Next.js dev server with a LLM model chosen from the terminal.
//
// Usage:
//   npm run dev:llm -- anthropic/claude-sonnet-4.5
//   npm run dev:llm -- anthropic/claude-sonnet-4.5 <api-key>
//
// Any environment variables already set (LLM_API_KEY, etc.) are preserved.
import { spawn } from 'node:child_process'

const model = process.argv[2]
const keyArg = process.argv[3]

if (!model) {
  console.error('Usage: npm run dev:llm -- <provider/model> [api-key]')
  console.error('Example: npm run dev:llm -- anthropic/claude-sonnet-4.5')
  process.exit(1)
}

const env = { ...process.env }
env.LLM_ENABLED = env.LLM_ENABLED || 'true'
env.LLM_PROVIDER = env.LLM_PROVIDER || 'openai'
env.LLM_BASE_URL = env.LLM_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
env.LLM_MODEL = model
if (keyArg) env.LLM_API_KEY = keyArg
// Also accept the canonical gateway env name.
if (!env.AI_GATEWAY_API_KEY && env.LLM_API_KEY) env.AI_GATEWAY_API_KEY = env.LLM_API_KEY

console.log(`[dev:llm] model=${env.LLM_MODEL}`)
console.log(`[dev:llm] base=${env.LLM_BASE_URL}`)
console.log(`[dev:llm] key=${env.LLM_API_KEY || env.AI_GATEWAY_API_KEY ? 'set' : 'MISSING (set LLM_API_KEY or AI_GATEWAY_API_KEY)'}`)

const child = spawn('npx', ['next', 'dev'], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))