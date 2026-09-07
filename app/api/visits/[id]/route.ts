import { ObjectId, type Document, type WithId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { DiagnosisItem, Patient, PrescriptionItem, Vitals, Visit } from '@/lib/types'

async function findVisit(id: string): Promise<WithId<Document> | null> {
  let _id: ObjectId
  try {
    _id = new ObjectId(id)
  } catch {
    return null
  }
  return (await visits()).findOne({ _id })
}

const STATUSES = ['waiting', 'in_progress', 'completed']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return guard([], async () => {
    const visitDoc = await findVisit(id)
    if (!visitDoc) throw jsonError('Visit not found', 404)

    const patientDoc = await (await patients()).findOne({ _id: new ObjectId(String(visitDoc.patientId)) })
    const historyDocs = await (await visits())
      .find({
        patientId: String(visitDoc.patientId),
        status: 'completed',
        _id: { $ne: visitDoc._id },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()

    return {
      visit: serializeDoc<Visit>(visitDoc),
      patient: patientDoc ? serializeDoc<Patient>(patientDoc) : null,
      history: serializeDocs<Visit>(historyDocs),
    }
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return guard(['doctor'], async (session) => {
    const existing = await findVisit(id)
    if (!existing) throw jsonError('Visit not found', 404)

    const body = await req.json()
    const set: Record<string, unknown> = {}

    if ('status' in body) {
      if (!STATUSES.includes(body.status)) throw jsonError('Invalid status', 400)
      set.status = body.status
      if (body.status === 'in_progress' && !existing.startedAt) {
        set.startedAt = new Date()
        set.doctorId = session.uid
      }
      if (body.status === 'completed') set.completedAt = new Date()
    }
    if ('diagnosis' in body) set.diagnosis = body.diagnosis as DiagnosisItem[]
    if ('prescription' in body) set.prescription = body.prescription as PrescriptionItem[]
    if ('notes' in body) set.notes = String(body.notes)
    if ('vitals' in body) set.vitals = body.vitals as Vitals
    if ('transcript' in body) set.transcript = body.transcript

    const result = await (await visits()).findOneAndUpdate(
      { _id: existing._id },
      { $set: set },
      { returnDocument: 'after' }
    )
    return { visit: serializeDoc<Visit>(result!) }
  })
}
