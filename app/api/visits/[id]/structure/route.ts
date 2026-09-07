import { ObjectId, type Collection, type WithId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { visits } from '@/lib/db'
import { extractRules } from '@/lib/extract'
import { llmEnabled, structureTranscript } from '@/lib/llm'
import { emptyVitals, mergeVitals, VITALS_KEYS } from '@/lib/vitals'
import type { DiagnosisItem, PrescriptionItem, Vitals } from '@/lib/types'

type VisitDoc = {
  diagnosis: DiagnosisItem[]
  prescription: PrescriptionItem[]
  vitals: Vitals
  transcript: { id: string; text: string; at: Date }[]
}

async function typedVisits(): Promise<Collection<VisitDoc>> {
  return (await visits()) as unknown as Collection<VisitDoc>
}

async function findVisit(id: string): Promise<WithId<VisitDoc> | null> {
  let _id: ObjectId
  try {
    _id = new ObjectId(id)
  } catch {
    return null
  }
  return (await typedVisits()).findOne({ _id })
}

function normaliseText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '')
}

const CATEGORIES = new Set<DiagnosisItem['category']>(['symptom', 'finding', 'vital', 'assessment', 'other'])

type MergedState = { diagnosis: DiagnosisItem[]; prescription: PrescriptionItem[]; vitals: Vitals }
type LlmResult = {
  vitals: Partial<Vitals>
  diagnosis: { text: string; category: string }[]
  prescription: { drug: string; dose: string; frequency: string; duration: string; notes: string }[]
}

function mergeLlmResult(base: MergedState, llm: LlmResult): MergedState {
  const diagnosis = [...base.diagnosis]
  const seenDiag = new Set(diagnosis.map((d) => normaliseText(d.text)))
  for (const d of llm.diagnosis) {
    const key = normaliseText(d.text)
    if (!key || seenDiag.has(key)) continue
    seenDiag.add(key)
    diagnosis.push({
      id: crypto.randomUUID(),
      text: d.text,
      category: CATEGORIES.has(d.category as DiagnosisItem['category']) ? (d.category as DiagnosisItem['category']) : 'other',
      source: 'ai',
      at: new Date().toISOString(),
    })
  }

  const prescription = [...base.prescription]
  const byDrug = new Map(prescription.map((p) => [normaliseText(p.drug), p]))
  for (const p of llm.prescription) {
    const key = normaliseText(p.drug)
    if (!key) continue
    const prior = byDrug.get(key)
    if (prior) {
      const merged: PrescriptionItem = {
        ...prior,
        dose: p.dose || prior.dose,
        frequency: p.frequency || prior.frequency,
        duration: p.duration || prior.duration,
        notes: p.notes || prior.notes,
        at: new Date().toISOString(),
      }
      byDrug.set(key, merged)
      const at = prescription.findIndex((x) => x.id === merged.id)
      if (at >= 0) prescription[at] = merged
      continue
    }
    const item: PrescriptionItem = {
      id: crypto.randomUUID(),
      drug: p.drug,
      dose: p.dose,
      frequency: p.frequency,
      duration: p.duration,
      notes: p.notes,
      source: 'ai',
      at: new Date().toISOString(),
    }
    byDrug.set(key, item)
    prescription.push(item)
  }

  return { diagnosis, prescription, vitals: mergeVitals(base.vitals, llm.vitals) }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return guard(['doctor'], async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw jsonError('Invalid JSON body', 400)
    }
    const transcript = (body as { transcript?: unknown })?.transcript
    if (typeof transcript !== 'string' || !transcript.trim()) {
      throw jsonError('transcript must be a non-empty string', 400)
    }
    if (transcript.length > 20000) {
      throw jsonError('transcript must be at most 20000 chars', 400)
    }

    const visitDoc = await findVisit(id)
    if (!visitDoc) throw jsonError('Visit not found', 404)
    const visitsCol = await typedVisits()

    await visitsCol.updateOne(
      { _id: visitDoc._id },
      { $push: { transcript: { id: crypto.randomUUID(), text: transcript, at: new Date() } } }
    )

    const existing: MergedState = {
      diagnosis: visitDoc.diagnosis ?? [],
      prescription: visitDoc.prescription ?? [],
      vitals: { ...emptyVitals(), ...(visitDoc.vitals ?? {}) },
    }

    const priorDiagCount = existing.diagnosis.length
    const priorRxCount = existing.prescription.length

    let result: MergedState = extractRules(transcript, existing)
    let source: 'rules' | 'llm' = 'rules'

    if (llmEnabled()) {
      const llmResult = await structureTranscript(transcript, result)
      if (llmResult) {
        source = 'llm'
        // Diagnosis is free text, so the rules' raw sentence and the model's rephrasing of
        // the same finding never dedup against each other and the doctor sees both. Per the
        // hybrid split (docs/RESEARCH.md §3.5) the model owns free-text diagnosis, so drop
        // the sentences the rules just added and let the model's version stand. Anything
        // already on the visit — earlier passes, manual entries — is untouched.
        const base: MergedState = {
          ...result,
          diagnosis: result.diagnosis.slice(0, priorDiagCount),
        }
        result = mergeLlmResult(base, llmResult)
      }
    }

    await visitsCol.updateOne(
      { _id: visitDoc._id },
      { $set: { diagnosis: result.diagnosis, prescription: result.prescription, vitals: result.vitals } }
    )

    const vitalsAdded = VITALS_KEYS.filter((k) => !existing.vitals[k] && result.vitals[k]).length

    return {
      vitals: result.vitals,
      diagnosis: result.diagnosis,
      prescription: result.prescription,
      added: {
        diagnosis: result.diagnosis.length - priorDiagCount,
        prescription: result.prescription.length - priorRxCount,
        vitals: vitalsAdded,
      },
      source,
    }
  })
}
