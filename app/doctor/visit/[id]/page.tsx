import { ObjectId } from 'mongodb'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { visits as visitsCol, patients as patientsCol, users as usersCol } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Visit, Patient } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { Consultation, type HistoryVisit } from './Consultation'

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return null
  if (!ObjectId.isValid(id)) notFound()

  const vcol = await visitsCol()
  const doc = await vcol.findOne({ _id: new ObjectId(id) })
  if (!doc) notFound()
  const visit = serializeDoc<Visit>(doc)

  const pcol = await patientsCol()
  const pdoc = await pcol.findOne({ _id: new ObjectId(visit.patientId) })
  if (!pdoc) notFound()
  const patient = serializeDoc<Patient>(pdoc)

  const historyDocs = await vcol
    .find({ patientId: visit.patientId, status: 'completed', _id: { $ne: new ObjectId(id) } })
    .sort({ createdAt: -1 })
    .toArray()
  const doctorIds = [...new Set(historyDocs.map((d) => d.doctorId).filter(Boolean))] as string[]
  const ucol = await usersCol()
  const udocs = doctorIds.length
    ? await ucol.find({ _id: { $in: doctorIds.map((did) => new ObjectId(did)) } }).toArray()
    : []
  const doctorNames = new Map(udocs.map((u) => [String(u._id), u.name as string]))
  const history: HistoryVisit[] = serializeDocs<Visit>(historyDocs).map((v) => ({
    ...v,
    doctorName: v.doctorId ? doctorNames.get(v.doctorId) ?? 'Unknown' : 'Unknown',
  }))

  // the prescriber is whoever owns the visit; falls back to the doctor opening it
  const prescriberId = visit.doctorId || session.uid
  const prescriber = ObjectId.isValid(prescriberId)
    ? await ucol.findOne({ _id: new ObjectId(prescriberId) })
    : null

  return (
    <Shell role="doctor" user={session} title="Consultation">
      <Consultation
        visit={visit}
        patient={patient}
        history={history}
        doctorName={(prescriber?.name as string) || session.name}
        department={(prescriber?.department as string) || ''}
      />
    </Shell>
  )
}
