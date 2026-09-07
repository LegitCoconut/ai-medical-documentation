import { ObjectId } from 'mongodb'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Patient, Visit } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { Card, EmptyState, StatusPill, Table, Td, Th } from '@/components/ui'
import { StartVisit } from './StartVisit'

async function getPatient(id: string) {
  let _id: ObjectId
  try {
    _id = new ObjectId(id)
  } catch {
    return null
  }
  const doc = await (await patients()).findOne({ _id })
  return doc ? serializeDoc<Patient>(doc) : null
}

async function getVisits(id: string) {
  const docs = await (await visits()).find({ patientId: id }).sort({ createdAt: -1 }).toArray()
  return serializeDocs<Visit>(docs)
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return null

  const patient = await getPatient(id)
  if (!patient) notFound()
  const patientVisits = await getVisits(id)

  return (
    <Shell role="reception" user={session} title="Patient">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold">{patient.name}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          <span className="font-mono">{patient.mrn}</span> · {patient.age}/{patient.sex}
        </p>
      </div>
      <div className="grid grid-cols-[380px_1fr] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <Card title="Patient details">
            <dl className="text-sm flex flex-col gap-2">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Phone</dt>
                <dd className="font-mono">{patient.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Address</dt>
                <dd>{patient.address || '—'}</dd>
              </div>
            </dl>
            {patient.allergies && (
              <div className="mt-3 border border-[var(--border-strong)] rounded px-3 py-2">
                <div className="label-xs mb-1">Allergies</div>
                <div className="text-sm">{patient.allergies}</div>
              </div>
            )}
          </Card>
          <StartVisit patientId={patient._id} />
        </div>
        <Card title="Visit history">
          {patientVisits.length === 0 ? (
            <EmptyState title="No previous visits." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Complaint</Th>
                  <Th>Diagnosis</Th>
                  <Th>Rx</Th>
                </tr>
              </thead>
              <tbody>
                {patientVisits.map((v) => (
                  <tr key={v._id}>
                    <Td>{new Date(v.createdAt).toLocaleDateString('en-GB')}</Td>
                    <Td><StatusPill status={v.status} /></Td>
                    <Td>{v.reason}</Td>
                    <Td>{v.diagnosis.length}</Td>
                    <Td>{v.prescription.length}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </Shell>
  )
}
