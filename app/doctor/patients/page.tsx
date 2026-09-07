import { getSession } from '@/lib/auth'
import { patients as patientsCol, visits as visitsCol, users as usersCol } from '@/lib/db'
import { serializeDocs } from '@/lib/types'
import type { Patient, Visit, User } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { PageHeader } from '@/components/ui'
import { PatientTable, type DoctorInfo } from './PatientTable'

// ponytail: a PHC won't exceed 500 patients; one query pair keeps this page simple.
// Add real pagination if a deployment ever grows past this.
const PATIENT_CAP = 500

async function loadPatients() {
  const pcol = await patientsCol()
  const patientDocs = await pcol.find({}).sort({ mrn: 1 }).limit(PATIENT_CAP).toArray()
  const patients = serializeDocs<Patient>(patientDocs)

  const ids = patients.map((p) => p._id)
  const vcol = await visitsCol()
  const visitDocs = ids.length
    ? await vcol.find({ patientId: { $in: ids } }).sort({ createdAt: -1 }).toArray()
    : []
  const latestVisits: Record<string, Visit> = {}
  // a patient's newest visit is often today's empty waiting one, which would hide the
  // medicines they are actually on — track the last visit that carries a prescription too
  const latestRxVisits: Record<string, Visit> = {}
  const visitCounts: Record<string, number> = {}
  for (const v of serializeDocs<Visit>(visitDocs)) {
    if (!latestVisits[v.patientId]) latestVisits[v.patientId] = v
    if (!latestRxVisits[v.patientId] && v.prescription.length > 0) latestRxVisits[v.patientId] = v
    visitCounts[v.patientId] = (visitCounts[v.patientId] ?? 0) + 1
  }

  const ucol = await usersCol()
  const userDocs = await ucol.find({}).toArray()
  const doctorNames: Record<string, DoctorInfo> = {}
  for (const u of serializeDocs<User>(userDocs)) {
    doctorNames[u._id] = { name: u.name, department: u.department || '' }
  }

  return { patients, latestVisits, latestRxVisits, visitCounts, doctorNames }
}

export default async function DoctorPatientsPage() {
  const session = await getSession()
  if (!session) return null
  const { patients, latestVisits, latestRxVisits, visitCounts, doctorNames } = await loadPatients()

  return (
    <Shell role="doctor" user={session} title="Patients">
      <PageHeader
        title="Patients"
        subtitle={`${patients.length} patient${patients.length === 1 ? '' : 's'} registered`}
      />
      <PatientTable
        patients={patients}
        latestVisits={latestVisits}
        latestRxVisits={latestRxVisits}
        visitCounts={visitCounts}
        doctorNames={doctorNames}
      />
    </Shell>
  )
}
