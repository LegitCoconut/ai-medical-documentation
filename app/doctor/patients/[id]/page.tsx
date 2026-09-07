import { ObjectId } from 'mongodb'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { patients as patientsCol, visits as visitsCol, users as usersCol } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Patient, Visit, User } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { PatientRecord } from './PatientRecord'
import type { DoctorInfo } from '../PatientTable'

async function getPatient(id: string) {
  let _id: ObjectId
  try {
    _id = new ObjectId(id)
  } catch {
    return null
  }
  const doc = await (await patientsCol()).findOne({ _id })
  return doc ? serializeDoc<Patient>(doc) : null
}

async function getVisits(id: string) {
  const docs = await (await visitsCol()).find({ patientId: id }).sort({ createdAt: -1 }).toArray()
  return serializeDocs<Visit>(docs)
}

async function getDoctorNames() {
  const docs = await (await usersCol()).find({}).toArray()
  const map: Record<string, DoctorInfo> = {}
  for (const u of serializeDocs<User>(docs)) {
    map[u._id] = { name: u.name, department: u.department || '' }
  }
  return map
}

export default async function DoctorPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return null

  const patient = await getPatient(id)
  if (!patient) notFound()
  const [visits, doctorNames] = await Promise.all([getVisits(id), getDoctorNames()])

  return (
    <Shell role="doctor" user={session} title="Patient">
      <Link
        href="/doctor/patients"
        className="text-[13px] text-[var(--muted)] hover:underline inline-block mb-4"
      >
        ← All patients
      </Link>
      <PatientRecord patient={patient} visits={visits} doctorNames={doctorNames} />
    </Shell>
  )
}
