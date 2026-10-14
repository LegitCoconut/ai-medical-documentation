import { ObjectId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import { llmEnabled, llmBaseUrl, llmModel, llmHeaders } from '@/lib/llm'
import type { Visit, Patient } from '@/lib/types'

/**
 * POST /api/patients/[id]/summarise
 * Body: { question?: string }   (optional free-form question from the doctor)
 *
 * Fetches all completed visits for the patient, assembles a rich context
 * prompt, and streams the answer from the local LLM as Server-Sent Events.
 *
 * If LLM is disabled it returns a structured JSON summary instead.
 */

const SYSTEM_PROMPT = `You are a clinical assistant helping a doctor quickly review a patient's medical history.
You will be given a patient's profile and their visit history (sorted newest first).
Answer the doctor's question concisely and factually using only the information provided.
Do not invent information. If something is not in the records, say so clearly.
Format your response in clear sections with short bullet points where appropriate.`

function buildContext(patient: Patient, history: Visit[]): string {
  const lines: string[] = []

  lines.push(`PATIENT`)
  lines.push(`Name: ${patient.name}`)
  lines.push(`MRN: ${patient.mrn}`)
  lines.push(`Age: ${patient.age}  Sex: ${patient.sex}`)
  if (patient.allergies) lines.push(`Allergies: ${patient.allergies}`)
  lines.push('')

  if (history.length === 0) {
    lines.push('No previous visit records found.')
    return lines.join('\n')
  }

  lines.push(`VISIT HISTORY (${history.length} completed visits, newest first)`)
  lines.push('')

  for (const v of history) {
    const date = new Date(v.createdAt).toLocaleDateString('en-GB')
    lines.push(`--- Visit ${date} ---`)
    lines.push(`Reason: ${v.reason}`)
    if (v.notes) lines.push(`Notes: ${v.notes}`)

    if (v.vitals && Object.values(v.vitals).some(Boolean)) {
      const vParts = []
      if (v.vitals.bp) vParts.push(`BP ${v.vitals.bp}`)
      if (v.vitals.temp) vParts.push(`Temp ${v.vitals.temp}`)
      if (v.vitals.pulse) vParts.push(`Pulse ${v.vitals.pulse}`)
      if (v.vitals.weight) vParts.push(`Wt ${v.vitals.weight}`)
      if (v.vitals.spo2) vParts.push(`SpO2 ${v.vitals.spo2}`)
      if (vParts.length) lines.push(`Vitals: ${vParts.join(', ')}`)
    }

    if (v.diagnosis?.length) {
      lines.push('Diagnosis/Findings:')
      for (const d of v.diagnosis) lines.push(`  • [${d.category}] ${d.text}`)
    }

    if (v.prescription?.length) {
      lines.push('Prescription:')
      for (const p of v.prescription) {
        const parts = [p.drug, p.dose, p.frequency, p.duration].filter(Boolean).join(' ')
        lines.push(`  • ${parts}${p.notes ? ` (${p.notes})` : ''}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return guard(['doctor'], async () => {
    let objId: ObjectId
    try {
      objId = new ObjectId(id)
    } catch {
      throw jsonError('Patient not found', 404)
    }

    const patientDoc = await (await patients()).findOne({ _id: objId })
    if (!patientDoc) throw jsonError('Patient not found', 404)

    const historyDocs = await (await visits())
      .find({ patientId: id, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    const patient = serializeDoc<Patient>(patientDoc)
    const history = serializeDocs<Visit>(historyDocs)

    let question: string
    try {
      const body = await req.json()
      question = typeof body?.question === 'string' && body.question.trim()
        ? body.question.trim()
        : 'Summarise this patient\'s medical history and highlight any important patterns or concerns.'
    } catch {
      question = 'Summarise this patient\'s medical history and highlight any important patterns or concerns.'
    }

    const context = buildContext(patient, history)
    const userMessage = `${context}\n\nDOCTOR'S QUESTION: ${question}`

    if (!llmEnabled()) {
      // LLM off — return plain structured summary
      return {
        text: context,
        source: 'structured',
        visitCount: history.length,
        patient: { name: patient.name, mrn: patient.mrn, age: patient.age, sex: patient.sex },
      }
    }

    const baseUrl = llmBaseUrl()
    const model = llmModel()

    if (!model) {
      console.warn('summarise: LLM_MODEL not set')
      throw jsonError('AI model is not configured (LLM_MODEL)', 502)
    }

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: llmHeaders(),
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      })
    } catch (err) {
      console.warn('summarise: llm request failed', err)
      throw jsonError('AI model unreachable', 502)
    }

    if (!upstreamRes.ok) {
      console.warn('summarise: llm bad status', upstreamRes.status)
      throw jsonError('AI model returned an error', 502)
    }

    let json: { choices?: { message?: { content?: string } }[] }
    try {
      json = await upstreamRes.json()
    } catch {
      throw jsonError('AI model returned non-JSON response', 502)
    }

    const text = json.choices?.[0]?.message?.content?.trim() ?? ''
    return {
      text,
      source: 'llm',
      visitCount: history.length,
      patient: { name: patient.name, mrn: patient.mrn, age: patient.age, sex: patient.sex },
    }
  })
}
