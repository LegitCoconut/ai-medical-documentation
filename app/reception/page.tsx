import { getSession } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Patient, Visit } from '@/lib/types'
import { ObjectId } from 'mongodb'
import Link from 'next/link'
import { Shell } from '@/components/Shell'
import { PageHeader } from '@/components/ui'
import { TodayBoard } from './TodayBoard'
import { PatientSearch } from './PatientSearch'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

async function getTodayVisits(): Promise<(Visit & { patient: Patient | null })[]> {
  const visitDocs = await (await visits())
    .find({ createdAt: { $gte: startOfToday() } })
    .sort({ createdAt: -1 })
    .toArray()

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

  return serializeDocs<Visit>(visitDocs).map((v) => ({
    ...v,
    patient: patientMap.get(v.patientId) ?? null,
  }))
}

export default async function ReceptionPage() {
  const session = await getSession()
  if (!session) return null

  const todayVisits = await getTodayVisits()
  const waiting = todayVisits.filter((v) => v.status === 'waiting').length
  const inProgress = todayVisits.filter((v) => v.status === 'in_progress').length
  const completed = todayVisits.filter((v) => v.status === 'completed').length
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Shell role="reception" user={session} title="Today">
      <PageHeader
        title="Today"
        subtitle={dateLabel}
        right={
          <Link href="/reception/patients/new" className="btn btn-primary btn-sm">
            Register patient
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Waiting" value={waiting} />
        <StatTile label="In progress" value={inProgress} />
        <StatTile label="Completed" value={completed} />
      </div>

      <TodayBoard initialVisits={todayVisits} />

      <div className="mt-8">
        <PatientSearch />
      </div>
    </Shell>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-mono font-semibold">{value}</div>
      <div className="label-xs mt-1">{label}</div>
    </div>
  )
}
