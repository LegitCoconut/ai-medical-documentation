import type { Vitals } from './types'

export const VITALS_KEYS = ['bp', 'temp', 'pulse', 'weight', 'spo2'] as const

export function emptyVitals(): Vitals {
  return { bp: '', temp: '', pulse: '', weight: '', spo2: '' }
}

export function mergeVitals(base: Vitals, incoming: Partial<Vitals>): Vitals {
  const merged = { ...emptyVitals(), ...base }
  for (const k of VITALS_KEYS) if (incoming[k]) merged[k] = incoming[k] as string
  return merged
}

function inRange(n: number, lo: number, hi: number): boolean {
  return n >= lo && n <= hi
}

// nearest number after the keyword wins; falls back to the nearest number before it —
// avoids a neighbouring vital's number bleeding across ("pulse 92, spo2 97")
function numberNear(text: string, keyword: RegExp, before: number, after: number): string | null {
  const re = new RegExp(keyword.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const afterStr = text.slice(m.index + m[0].length, m.index + m[0].length + after)
    const afterNum = afterStr.match(/\d+(?:\.\d+)?/)
    if (afterNum) return afterNum[0]
    const beforeStr = text.slice(Math.max(0, m.index - before), m.index)
    const beforeNums = [...beforeStr.matchAll(/\d+(?:\.\d+)?/g)]
    if (beforeNums.length) return beforeNums[beforeNums.length - 1][0]
  }
  return null
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function extractBp(text: string): string {
  const m = text.match(/\b(\d{2,3})\s*(?:\/|over|by)\s*(\d{2,3})\b/i)
  return m ? `${m[1]}/${m[2]}` : ''
}

const TEMP_F_RE = /(\d{2,3}(?:\.\d+)?)\s*(?:degrees?|deg\.?|°)?\s*f(?:ahrenheit)?\b/i
const TEMP_KEYWORD_RE = /\b(?:temp|temperature|fever|febrile)\b/i

function extractTemp(text: string): string {
  const fMatch = text.match(TEMP_F_RE)
  if (fMatch) {
    const n = parseFloat(fMatch[1])
    if (inRange(n, 95, 110)) return `${fmtNum(n)} F`
  }
  const near = numberNear(text, TEMP_KEYWORD_RE, 15, 20)
  if (near !== null) {
    const n = parseFloat(near)
    if (inRange(n, 35, 43)) return fmtNum(n)
    if (inRange(n, 95, 110)) return `${fmtNum(n)} F`
  }
  return ''
}

const PULSE_KEYWORD_RE = /\b(?:pulse|heart rate|hr)\b/i
function extractPulse(text: string): string {
  const near = numberNear(text, PULSE_KEYWORD_RE, 15, 20)
  if (near === null) return ''
  const n = parseFloat(near)
  return inRange(n, 30, 220) ? String(n) : ''
}

const SPO2_KEYWORD_RE = /\b(?:spo2|sats?|saturation|oxygen)\b/i
function extractSpo2(text: string): string {
  const near = numberNear(text, SPO2_KEYWORD_RE, 15, 20)
  if (near === null) return ''
  const n = parseFloat(near)
  return inRange(n, 50, 100) ? String(n) : ''
}

const WEIGHT_KEYWORD_RE = /\b(?:weight|weighs|kg)\b/i
function extractWeight(text: string): string {
  const near = numberNear(text, WEIGHT_KEYWORD_RE, 15, 20)
  if (near === null) return ''
  const n = parseFloat(near)
  return inRange(n, 1, 300) ? String(n) : ''
}

export function extractVitals(text: string): Vitals {
  return {
    bp: extractBp(text),
    temp: extractTemp(text),
    pulse: extractPulse(text),
    weight: extractWeight(text),
    spo2: extractSpo2(text),
  }
}
