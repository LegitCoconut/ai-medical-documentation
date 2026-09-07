import { matchDrug } from './drugs'
import { emptyVitals, extractVitals, mergeVitals } from './vitals'
import type { DiagnosisItem, PrescriptionItem, Vitals } from './types'

export const SENTENCE_SPLIT = /(?<=[.?!])\s+|\n+|\s+and then\s+/i

export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function normaliseText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '')
}

const FILLER_WORDS = new Set([
  'okay', 'ok', 'right', 'alright', 'yes', 'yeah', 'no', 'nah', 'hmm', 'let', 'me', 'see', 'lets', "let's",
])

function isFiller(sentence: string): boolean {
  const words = sentence.toLowerCase().replace(/[^a-z'\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length < 3) return true
  return words.every((w) => FILLER_WORDS.has(w))
}

function tokenize(sentence: string): string[] {
  return sentence.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
}

function findDrug(sentence: string): string | null {
  const words = tokenize(sentence)
  const candidates: string[] = [...words]
  for (let i = 0; i < words.length - 1; i++) candidates.push(`${words[i]} ${words[i + 1]}`)
  let best: { drug: string; score: number } | null = null
  for (const cand of candidates) {
    if (cand.length < 3 || /^\d+$/.test(cand)) continue
    const m = matchDrug(cand)
    if (m && (!best || m.score > best.score)) best = m
  }
  return best ? best.drug : null
}

const DOSE_UNIT_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|tabs?|tablets?|drops?)\b/i

function extractDose(sentence: string): string {
  const m = sentence.match(DOSE_UNIT_RE)
  if (m) return `${m[1]} ${m[2].toLowerCase()}`
  for (const bm of sentence.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
    const idx = bm.index ?? 0
    const after = sentence.slice(idx + bm[0].length, idx + bm[0].length + 12).toLowerCase()
    const before = sentence.slice(Math.max(0, idx - 5), idx).toLowerCase()
    if (/^\s*\/?\s*7\b/.test(after)) continue
    if (/^\s*(day|days|week|weeks|month|months)\b/.test(after)) continue
    if (/\b(for|x)\s*$/.test(before)) continue
    return bm[0]
  }
  return ''
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
}
const DAY_WORD = '(day|days|week|weeks|month|months)'

function normalizeDuration(n: number, unit: string): string {
  const base = unit.replace(/s$/, '')
  return `${n} ${base}${n === 1 ? '' : 's'}`
}

function extractDuration(sentence: string): string {
  let m = sentence.match(new RegExp(`for\\s+(\\d+)\\s*${DAY_WORD}`, 'i'))
  if (m) return normalizeDuration(parseInt(m[1], 10), m[2])
  m = sentence.match(/x\s*(\d+)\s*days?/i)
  if (m) return normalizeDuration(parseInt(m[1], 10), 'day')
  m = sentence.match(/(\d+)\s*\/\s*7\b/)
  if (m) return normalizeDuration(parseInt(m[1], 10), 'day')
  m = sentence.match(new RegExp(`for\\s+(${Object.keys(WORD_NUM).join('|')})\\s*${DAY_WORD}`, 'i'))
  if (m) return normalizeDuration(WORD_NUM[m[1].toLowerCase()], m[2])
  return ''
}

const FREQ_SHORTHAND = /\b(OD|BD|TDS|TID|QID|QDS|HS|SOS|STAT)\b/i
const FREQ_NUMERIC = /\b[01]-[01]-[01]\b/

function extractFrequency(sentence: string): string {
  const sh = sentence.match(FREQ_SHORTHAND)
  if (sh) {
    const up = sh[1].toUpperCase()
    if (up === 'TID') return 'TDS'
    if (up === 'QDS') return 'QID'
    return up
  }
  const num = sentence.match(FREQ_NUMERIC)
  if (num) return num[0]
  const s = sentence.toLowerCase()
  if (/\bonce a day\b|\bonce daily\b/.test(s)) return 'OD'
  if (/\btwice a day\b|\btwice daily\b/.test(s)) return 'BD'
  if (/\bthree times a day\b|\bthree times daily\b|\bthrice\b/.test(s)) return 'TDS'
  if (/\bfour times a day\b|\bfour times daily\b/.test(s)) return 'QID'
  if (/\bat night\b|\bbefore bed\b|\bbedtime\b/.test(s)) return 'HS'
  if (/\bas needed\b|\bif required\b|\bwhen necessary\b/.test(s)) return 'SOS'
  if (/\bimmediately\b|\bat once\b/.test(s)) return 'STAT'
  return ''
}

const NOTE_PATTERNS: [RegExp, string][] = [
  [/after food/i, 'after food'],
  [/before food/i, 'before food'],
  [/empty stomach/i, 'empty stomach'],
  [/with milk/i, 'with milk'],
  [/sos only/i, 'SOS only'],
]

function extractNotes(sentence: string): string {
  return NOTE_PATTERNS.filter(([re]) => re.test(sentence)).map(([, label]) => label).join(', ')
}

function wordsRegex(words: string[]): RegExp {
  return new RegExp(`\\b(${words.join('|')})\\b`, 'i')
}

const VITAL_PATTERNS = [
  /\b(temp|temperature|fever)\b.{0,15}?\d{2,3}(\.\d)?/i,
  /\d{2,3}(\.\d)?\s*(degrees?|deg|°)?\s*(c|f|celsius|fahrenheit)\b/i,
  /\d{2,3}\s*(\/|over)\s*\d{2,3}/,
  /\b(pulse|heart rate|hr)\b.{0,10}?\d{2,3}/i,
  /\b(spo2|saturation|sats?)\b.{0,10}?\d{2,3}/i,
  /\bweight\b.{0,10}?\d{1,3}\s*kg/i,
]
const FINDING_RE = wordsRegex([
  'chest', 'lung', 'lungs', 'breath sounds', 'auscultation', 'air entry', 'abdomen', 'tender',
  'tenderness', 'throat', 'tonsil', 'ear', 'eye', 'pallor', 'oedema', 'edema', 'murmur', 'rales',
  'crepitations', 'wheeze', 'clear', 'normal', 'soft', 'no organomegaly',
])
const SYMPTOM_RE = wordsRegex([
  'complains', 'complaining', 'pain', 'ache', 'fever', 'cough', 'cold', 'vomiting', 'loose motion',
  'diarrhoea', 'headache', 'giddiness', 'weakness', 'since', 'for the past', 'started',
])
const ASSESSMENT_RE = wordsRegex([
  'likely', 'probable', 'impression', 'diagnosis', 'suggestive of', 'rule out', 'r/o',
  'appears to be', 'consistent with',
])

function classify(sentence: string): DiagnosisItem['category'] {
  if (VITAL_PATTERNS.some((re) => re.test(sentence))) return 'vital'
  // "likely"/"probable"/"suggestive of" are explicit diagnostic markers and outrank an
  // incidental symptom word — "Likely viral fever" is an assessment, not a symptom
  if (ASSESSMENT_RE.test(sentence)) return 'assessment'
  if (FINDING_RE.test(sentence)) return 'finding'
  if (SYMPTOM_RE.test(sentence)) return 'symptom'
  return 'other'
}

function cleanDiagnosisText(s: string): string {
  let t = s.trim().replace(/\s+/g, ' ').replace(/^the patient\s+/i, '').replace(/[.!?]+$/, '')
  if (t.length) t = t[0].toUpperCase() + t.slice(1)
  return t
}

// a sentence made up of nothing but vital keywords/numbers reports to vitals only —
// it must not also spawn a duplicate "vital" diagnosis line
const VITALS_STOPWORDS = new Set([
  'bp', 'blood', 'pressure', 'temp', 'temperature', 'fever', 'febrile', 'degrees', 'degree', 'deg',
  'celsius', 'fahrenheit', 'pulse', 'heart', 'rate', 'hr', 'spo2', 'saturation', 'sats', 'sat',
  'oxygen', 'weight', 'weighs', 'kg', 'over', 'by', 'is', 'and', 'the', 'patient', 'patients', 'f', 'c',
])

function isVitalsOnlySentence(sentence: string): boolean {
  const words = sentence
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .replace(/[^a-z0-9.\s/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.every(
    (w) => VITALS_STOPWORDS.has(w) || /^\d+(\.\d+)?$/.test(w) || /^\d+\/\d+$/.test(w)
  )
}

export function extractRules(
  transcript: string,
  existing: { diagnosis: DiagnosisItem[]; prescription: PrescriptionItem[]; vitals: Vitals }
): { diagnosis: DiagnosisItem[]; prescription: PrescriptionItem[]; vitals: Vitals } {
  const diagnosis: DiagnosisItem[] = [...existing.diagnosis]
  const prescription: PrescriptionItem[] = [...existing.prescription]
  // keyed by drug so a repeat mention updates that line rather than being dropped —
  // the doctor correcting a dose out loud must reach the prescription
  const byDrug = new Map(prescription.map((p) => [normaliseText(p.drug), p]))
  const seenDiag = new Set(diagnosis.map((d) => normaliseText(d.text)))
  let vitals: Vitals = { ...emptyVitals(), ...existing.vitals }

  for (const sentence of splitSentences(transcript)) {
    const drug = findDrug(sentence)
    if (drug) {
      const key = normaliseText(drug)
      const heard = {
        dose: extractDose(sentence),
        frequency: extractFrequency(sentence),
        duration: extractDuration(sentence),
        notes: extractNotes(sentence),
      }
      const prior = byDrug.get(key)
      if (prior) {
        // only fields actually re-stated overwrite; silence leaves the old value alone
        const merged: PrescriptionItem = {
          ...prior,
          dose: heard.dose || prior.dose,
          frequency: heard.frequency || prior.frequency,
          duration: heard.duration || prior.duration,
          notes: heard.notes || prior.notes,
          at: new Date().toISOString(),
        }
        const changed = (['dose', 'frequency', 'duration', 'notes'] as const).some(
          (f) => merged[f] !== prior[f]
        )
        if (changed) {
          byDrug.set(key, merged)
          const at = prescription.findIndex((x) => x.id === merged.id)
          if (at >= 0) prescription[at] = merged
        }
        continue
      }
      const item: PrescriptionItem = {
        id: crypto.randomUUID(),
        drug,
        ...heard,
        source: 'ai',
        at: new Date().toISOString(),
      }
      byDrug.set(key, item)
      prescription.push(item)
      continue
    }
    // vitals extraction runs before the filler check — a bare "Temp 38.4" is short enough
    // to look like filler by word count alone, but it is real data
    const sentenceVitals = extractVitals(sentence)
    const hasVital = Object.values(sentenceVitals).some(Boolean)
    if (hasVital) {
      vitals = mergeVitals(vitals, sentenceVitals)
      if (isVitalsOnlySentence(sentence)) continue
    }
    if (isFiller(sentence)) continue

    const cleaned = cleanDiagnosisText(sentence)
    if (!cleaned) continue
    const key = normaliseText(cleaned)
    if (seenDiag.has(key)) continue
    seenDiag.add(key)
    diagnosis.push({
      id: crypto.randomUUID(),
      text: cleaned,
      category: classify(sentence),
      source: 'ai',
      at: new Date().toISOString(),
    })
  }
  return { diagnosis, prescription, vitals }
}
