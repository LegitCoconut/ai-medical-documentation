import { getSession } from '@/lib/auth'
import { patients } from '@/lib/db'
import { serializeDocs } from '@/lib/types'
import type { Patient } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { PageHeader } from '@/components/ui'
import Link from 'next/link'
import { PatientTable } from './PatientTable'

async function getAllPatients(): Promise<Patient[]> {
  const docs = await (await patients()).find({}).sort({ createdAt: -1 }).limit(200).toArray()
  return serializeDocs<Patient>(docs)
}

export default async function PatientsPage() {
  const session = await getSession()
  if (!session) return null

  const allPatients = await getAllPatients()

  return (
    <Shell role="reception" user={session} title="Patients">
      <PageHeader
        title="Patients"
        subtitle={`${allPatients.length} registered`}
        right={
          <Link href="/reception/patients/new" className="btn btn-primary btn-sm">
            + Register patient
          </Link>
        }
      />
      <PatientTable initialPatients={allPatients} />
    </Shell>
  )
}
