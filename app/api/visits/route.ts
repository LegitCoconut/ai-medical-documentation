import { ObjectId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { patients, visits, users } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import { sendAppointmentEmail } from '@/lib/email'
import type { Patient, Vitals, Visit, User } from '@/lib/types'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * POST /api/visits
 * Extended to support:
 *   - doctorId (optional, assigns directly)
 *   - patientEmail (optional, triggers appointment email)
 */
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
    const assignedDoctorId = body.doctorId ? String(body.doctorId) : null
    const patientEmail = body.patientEmail ? String(body.patientEmail).trim() : null

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

    // Count today's visits to determine token number
    const todayCount = await visitsCol.countDocuments({ createdAt: { $gte: startOfToday() } })
    const tokenNumber = todayCount + 1

    const now = new Date()
    const doc = {
      patientId,
      doctorId: assignedDoctorId,
      status: 'waiting' as const,
      reason,
      vitals,
      diagnosis: [],
      prescription: [],
      transcript: [],
      notes: '',
      createdBy: session.uid,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    }
    const res = await visitsCol.insertOne(doc)
    const visitId = String(res.insertedId)
    const visit = serializeDoc<Visit>({ ...doc, _id: res.insertedId })

    // Resolve doctor details for email
    let doctorName = 'To be assigned'
    let doctorDepartment: string | undefined
    if (assignedDoctorId) {
      try {
        const doctorDoc = await (await users()).findOne({ _id: new ObjectId(assignedDoctorId) })
        if (doctorDoc) {
          const doctor = serializeDoc<User>(doctorDoc)
          doctorName = doctor.name
          doctorDepartment = doctor.department
        }
      } catch { /* ignore */ }
    }

    const patient = serializeDoc<Patient>(patientDoc)

    // Send email if patient email provided
    let emailStatus: { sent: boolean; error?: string } = { sent: false }
    const emailAddr = patientEmail || (patientDoc.email as string | undefined)
    if (emailAddr) {
      emailStatus = await sendAppointmentEmail({
        to: emailAddr,
        patientName: patient.name,
        mrn: patient.mrn,
        visitId,
        tokenNumber,
        doctorName,
        doctorDepartment,
        reason,
        appointmentTime: now.toISOString(),
      }).catch((err) => ({ sent: false, error: String(err) }))
    }

    return { visit, tokenNumber, emailStatus }
  })
}
