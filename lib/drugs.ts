import fs from 'fs'
import path from 'path'

const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'drugs.txt'), 'utf8')

export const DRUGS: string[] = raw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

// Non-distinctive tokens: they appear inside multi-word entries ("Iron and Folic Acid")
// but are never a drug on their own. Without this, "and"/"with"/"tab" match at score 1.0.
const STOP = new Set([
  'and', 'with', 'acid', 'gel', 'oral', 'human', 'husk', 'drop', 'drops', 'eye', 'ear',
  'lotion', 'toxoid', 'combined', 'contraceptive', 'sulphate', 'sulfate', 'carbonate',
  'chloride', 'bicarbonate', 'saline', 'normal', 'lactate', 'iodine', 'peroxide',
  'complex', 'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'syrup', 'injection', 'cream', 'ointment', 'solution', 'the', 'for',
])

// two-row DP Levenshtein — avoids the O(n*m) matrix
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  let score = 1 - levenshtein(a, b) / maxLen
  if (a.startsWith(b) || b.startsWith(a)) score = Math.min(1, score + 0.05)
  return score
}

export function matchDrug(candidate: string): { drug: string; score: number } | null {
  const c = candidate.toLowerCase().trim()
  if (!c || STOP.has(c)) return null

  const exact = DRUGS.find((d) => d.toLowerCase() === c)
  if (exact) return { drug: exact, score: 1 }
  // below 4 chars fuzzy matching is noise; only the exact hit above counts (e.g. "ORS")
  if (c.length < 4) return null

  let best: { drug: string; score: number } | null = null
  for (const drug of DRUGS) {
    const d = drug.toLowerCase()
    let score = Math.max(similarity(c, d), similarity(c, d.replace(/-/g, ' ')))
    for (const token of d.split(/[\s-]+/)) {
      if (token.length < 4 || STOP.has(token)) continue
      score = Math.max(score, similarity(c, token))
    }
    if (!best || score > best.score) best = { drug, score }
  }
  return best && best.score >= 0.72 ? best : null
}
