import { ObjectId } from 'mongodb'
import { getSession } from '@/lib/auth'
import { visits as visitsCol, patients as patientsCol } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Visit, Patient } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { Queue } from './Queue'

async function getTodayVisits(): Promise<(Visit & { patient: Patient })[]> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const vcol = await visitsCol()
  const docs = await vcol.find({ createdAt: { $gte: start } }).sort({ createdAt: -1 }).toArray()
  const pcol = await patientsCol()
  const ids = [...new Set(docs.map((d) => String(d.patientId)))]
  const pdocs = ids.length
    ? await pcol.find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }).toArray()
    : []
  const pmap = new Map(pdocs.map((p) => [String(p._id), serializeDoc<Patient>(p)]))
  return serializeDocs<Visit>(docs).map((v) => ({ ...v, patient: pmap.get(v.patientId)! }))
}

export default async function DoctorPage() {
  const session = await getSession()
  if (!session) return null
  const visits = await getTodayVisits()

  return (
    <Shell role="doctor" user={session} title="Queue">
      <Queue initialVisits={visits} meId={session.uid} />
    </Shell>
  )
}
