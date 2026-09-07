import { ObjectId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc } from '@/lib/types'
import type { Patient, Vitals, Visit } from '@/lib/types'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: Request) {
  return guard([], async () => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const today = searchParams.get('today')
    const doctorId = searchParams.get('doctorId')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (doctorId) filter.doctorId = doctorId
    if (today === '1') filter.createdAt = { $gte: startOfToday() }

    const visitDocs = await (await visits()).find(filter).sort({ createdAt: -1 }).toArray()

    const patientIds = [...new Set(visitDocs.map((v) => String(v.patientId)))]
    const objectIds = patientIds.flatMap((pid) => {
      try {
        return [new ObjectId(pid)]
      } catch {
        return []
      }
    })
    const patientDocs = objectIds.length
      ? await (await patients()).find({ _id: { $in: objectIds } }).toArray()
      : []
    const patientMap = new Map(patientDocs.map((p) => [String(p._id), serializeDoc<Patient>(p)]))

    // a visit whose patient no longer exists is unusable in every consumer — drop it
    // rather than emit `patient: null` for the UI to dereference
    const result = visitDocs.flatMap((v) => {
      const patient = patientMap.get(String(v.patientId))
      return patient ? [{ ...serializeDoc<Visit>(v), patient }] : []
    })

    return { visits: result }
  })
}

export async function POST(req: Request) {
  return guard(['reception'], async (session) => {
    const body = await req.json()
    const patientId = String(body.patientId ?? '')
    const reason = String(body.reason ?? '').trim()
    const vitals: Vitals = body.vitals ?? {}

    if (!patientId) throw jsonError('patientId is required', 400)
    if (!reason) throw jsonError('Reason is required', 400)

    let objId: ObjectId
    try {
      objId = new ObjectId(patientId)
    } catch {
      throw jsonError('Patient not found', 404)
    }
    const patientDoc = await (await patients()).findOne({ _id: objId })
    if (!patientDoc) throw jsonError('Patient not found', 404)

    const visitsCol = await visits()
    const existing = await visitsCol.findOne({
      patientId,
      status: { $ne: 'completed' },
      createdAt: { $gte: startOfToday() },
    })
    if (existing) throw jsonError('This patient already has an open visit today.', 409)

    const doc = {
      patientId,
      doctorId: null,
      status: 'waiting' as const,
      reason,
      vitals,
      diagnosis: [],
      prescription: [],
      transcript: [],
      notes: '',
      createdBy: session.uid,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    }
    const res = await visitsCol.insertOne(doc)
    return { visit: serializeDoc<Visit>({ ...doc, _id: res.insertedId }) }
  })
}
