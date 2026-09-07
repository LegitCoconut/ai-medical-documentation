'use client'

import { useMemo, useState } from 'react'
import { Card, EmptyState, StatusPill, Table, Td, Th } from '@/components/ui'
import type { Patient, Visit, Vitals } from '@/lib/types'
import { VisitDialog } from '../VisitDialog'
import type { DoctorInfo } from '../PatientTable'

const VITAL_LABELS: [keyof Vitals, string][] = [
  ['bp', 'BP'],
  ['temp', 'T'],
  ['pulse', 'P'],
  ['weight', 'W'],
  ['spo2', 'SpO2'],
]

function formatDMY(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function dash(v: string | number | undefined | null): string | number {
  if (v === undefined || v === null || v === '') return '—'
  return v
}

function vitalsSummary(vitals: Vitals): string {
  const parts = VITAL_LABELS.filter(([k]) => (vitals[k] ?? '').trim()).map(
    ([k, label]) => `${label} ${vitals[k]}`
  )
  return parts.length ? parts.join(' · ') : '—'
}

function resolveDoctor(doctorId: string | null, map: Record<string, DoctorInfo>): DoctorInfo {
  if (!doctorId) return { name: '', department: '' }
  return map[doctorId] ?? { name: '', department: '' }
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--border)] rounded px-3 py-2 flex-1">
      <div className="font-mono text-lg leading-tight">{value}</div>
      <div className="label-xs mt-0.5">{label}</div>
    </div>
  )
}

export function PatientRecord({
  patient,
  visits,
  doctorNames,
}: {
  patient: Patient
  visits: Visit[]
  doctorNames: Record<string, DoctorInfo>
}) {
  const [selected, setSelected] = useState<Visit | null>(null)

  const latestRxVisit = useMemo(() => visits.find((v) => v.prescription.length > 0), [visits])
  const medicineCount = useMemo(() => {
    if (!latestRxVisit) return 0
    return new Set(latestRxVisit.prescription.map((p) => p.drug.trim().toLowerCase()).filter(Boolean)).size
  }, [latestRxVisit])

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[20px] font-semibold">{patient.name}</h1>
          <span className="font-mono text-sm text-[var(--muted)]">{patient.mrn}</span>
          <span className="text-sm text-[var(--muted)]">
            {patient.age} / {patient.sex}
          </span>
          <span className="font-mono text-sm text-[var(--muted)]">{patient.phone}</span>
        </div>
        {patient.allergies && (
          <div className="mt-3 border border-[var(--border-strong)] border-l-2 border-l-black rounded px-3 py-2 inline-block">
            <div className="label-xs mb-0.5">Allergies</div>
            <div className="text-sm">{patient.allergies}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[380px_1fr] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <Card title="Patient information">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <span className="text-[var(--muted)]">Full name</span>
              <span>{patient.name}</span>
              <span className="text-[var(--muted)]">MRN</span>
              <span className="font-mono">{patient.mrn}</span>
              <span className="text-[var(--muted)]">Age</span>
              <span>{patient.age}</span>
              <span className="text-[var(--muted)]">Sex</span>
              <span>{patient.sex}</span>
              <span className="text-[var(--muted)]">Phone</span>
              <span className="font-mono">{patient.phone}</span>
              <span className="text-[var(--muted)]">Address</span>
              <span>{dash(patient.address)}</span>
              <span className="text-[var(--muted)]">Allergies</span>
              <span>{dash(patient.allergies)}</span>
              <span className="text-[var(--muted)]">Registered</span>
              <span className="font-mono">{formatDMY(patient.createdAt)}</span>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Total visits" value={visits.length} />
            <StatTile label="Last visit" value={visits[0] ? formatDMY(visits[0].createdAt) : '—'} />
            <StatTile label="Medicines listed" value={medicineCount} />
          </div>
        </div>

        <Card title="Visit history">
          {visits.length === 0 ? (
            <EmptyState title="No visits on record for this patient." />
          ) : (
            <div className="-mx-4 -mb-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th>Complaint</Th>
                    <Th>Vitals</Th>
                    <Th>Findings</Th>
                    <Th>Medicines</Th>
                    <Th>Doctor</Th>
                    <Th>{''}</Th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => {
                    const doctor = resolveDoctor(v.doctorId, doctorNames)
                    return (
                      <tr
                        key={v._id}
                        tabIndex={0}
                        className="cursor-pointer hover:bg-[#f7f7f7]"
                        onClick={() => setSelected(v)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setSelected(v)
                        }}
                      >
                        <Td>
                          <span className="font-mono">{formatDMY(v.createdAt)}</span>
                        </Td>
                        <Td>
                          <StatusPill status={v.status} />
                        </Td>
                        <Td>{v.reason || '—'}</Td>
                        <Td>
                          <span className="font-mono text-xs">{vitalsSummary(v.vitals)}</span>
                        </Td>
                        <Td>
                          <span className="font-mono">{v.diagnosis.length}</span>
                        </Td>
                        <Td>
                          <span className="font-mono">{v.prescription.length}</span>
                        </Td>
                        <Td>{doctor.name || '—'}</Td>
                        <Td>
                          <span className="text-[var(--muted)] text-xs hover:text-[var(--text)]">View</span>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {selected && (
        <VisitDialog
          patient={patient}
          visit={selected}
          doctorName={resolveDoctor(selected.doctorId, doctorNames).name}
          department={resolveDoctor(selected.doctorId, doctorNames).department}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
