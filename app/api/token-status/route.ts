import { visits, patients } from '@/lib/db'
import { ObjectId } from 'mongodb'

/**
 * GET /api/token-status?mrn=P-0001
 *
 * Public endpoint — no authentication required.
 * Returns the patient's token position in today's queue.
 */

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mrn = searchParams.get('mrn')?.trim().toUpperCase()

  if (!mrn) {
    return Response.json({ error: 'mrn is required' }, { status: 400 })
  }

  const visitsCol = await visits()

  // Find all of today's visits sorted by creation time (queue order)
  const todayVisits = await visitsCol
    .find({ createdAt: { $gte: startOfToday() } })
    .sort({ createdAt: 1 })
    .toArray()

  if (todayVisits.length === 0) {
    return Response.json({ found: false, message: 'No visits registered today.' })
  }

  const patientIds = [...new Set(todayVisits.map((v) => String(v.patientId)))]
  const objectIds = patientIds.flatMap((pid) => {
    try { return [new ObjectId(pid)] } catch { return [] }
  })

  const patientCol = await patients()
  const patientDocs = objectIds.length
    ? await patientCol.find({ _id: { $in: objectIds } }).toArray()
    : []

  const mrnToId = new Map(patientDocs.map((p) => [String(p.mrn).toUpperCase(), String(p._id)]))
  const patientId = mrnToId.get(mrn)

  if (!patientId) {
    return Response.json({ found: false, message: 'No visit found for this token today.' })
  }

  // Find this patient's visit
  const myVisit = todayVisits.find((v) => String(v.patientId) === patientId)
  if (!myVisit) {
    return Response.json({ found: false, message: 'No visit found for this token today.' })
  }

  const status = myVisit.status as 'waiting' | 'in_progress' | 'completed'

  // Count how many patients are ahead (waiting, registered before this patient)
  const myTime = new Date(myVisit.createdAt).getTime()
  const ahead = todayVisits.filter(
    (v) =>
      v.status === 'waiting' &&
      String(v.patientId) !== patientId &&
      new Date(v.createdAt as Date).getTime() < myTime
  ).length

  const totalWaiting = todayVisits.filter((v) => v.status === 'waiting').length
  const totalToday = todayVisits.length

  // Token number = position in today's queue (1-indexed by registration time)
  const tokenNumber = todayVisits.indexOf(myVisit) + 1

  return Response.json({
    found: true,
    mrn,
    status,
    tokenNumber,
    ahead: status === 'waiting' ? ahead : 0,
    totalWaiting,
    totalToday,
    reason: myVisit.reason,
    registeredAt: myVisit.createdAt,
  })
}
