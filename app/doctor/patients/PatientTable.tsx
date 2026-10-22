'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, Input, Table, Th, Td, EmptyState } from '@/components/ui'
import type { Patient, Visit } from '@/lib/types'
import { VisitDialog } from './VisitDialog'

export type DoctorInfo = { name: string; department: string }

function formatDMY(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function Avatar({ name, sex }: { name: string; sex: string }) {
  const tone = sex === 'F' ? 'bg-rose-100 text-rose-700' : sex === 'M' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${tone}`}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

function resolveDoctor(doctorId: string | null, map: Record<string, DoctorInfo>): DoctorInfo {
  if (!doctorId) return { name: '', department: '' }
  return map[doctorId] ?? { name: '', department: '' }
}

export function PatientTable({
  patients,
  latestVisits,
  latestRxVisits,
  visitCounts,
  doctorNames,
}: {
  patients: Patient[]
  latestVisits: Record<string, Visit>
  latestRxVisits: Record<string, Visit>
  visitCounts: Record<string, number>
  doctorNames: Record<string, DoctorInfo>
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [dialogFor, setDialogFor] = useState<{ patient: Patient; visit: Visit } | null>(null)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return patients
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.mrn.toLowerCase().includes(query) ||
        p.phone.includes(query)
    )
  }, [q, patients])

  return (
    <Card>
      <Input
        placeholder="Search by name, MRN or phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm mb-4 !rounded-full !pl-4"
      />
      {patients.length === 0 && <EmptyState title="No patients registered yet." />}
      {patients.length > 0 && filtered.length === 0 && (
        <EmptyState title="No patient matches that name, MRN or phone." />
      )}
      {filtered.length > 0 && (
        <div className="-mx-4 -mb-4">
          <Table>
            <thead>
              <tr>
                <Th>MRN</Th>
                <Th>Patient</Th>
                <Th>Age/Sex</Th>
                <Th>Phone</Th>
                <Th>Last visit</Th>
                <Th>Visits</Th>
                <Th>Latest prescription</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const visit = latestVisits[p._id]
                const rxVisit = latestRxVisits[p._id]
                const href = `/doctor/patients/${p._id}`
                return (
                  <tr
                    key={p._id}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-teal-50/70 transition-colors"
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') router.push(href)
                    }}
                  >
                    <Td>
                      <Link
                        href={href}
                        className="font-mono text-[12px] rounded-md bg-teal-50 text-teal-800 px-2 py-0.5 hover:bg-teal-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.mrn}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} sex={p.sex} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-[var(--muted)]">{p.age} yrs · {p.sex}</span>
                    </Td>
                    <Td>
                      <span className="font-mono">{p.phone}</span>
                    </Td>
                    <Td>
                      {visit ? (
                        <span className="font-mono">{formatDMY(visit.createdAt)}</span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex min-w-6 justify-center rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-[12px] font-semibold">
                        {visitCounts[p._id] ?? 0}
                      </span>
                    </Td>
                    <Td>
                      {!rxVisit && (
                        <span className="text-[var(--muted)]">
                          {visit ? 'No medicines' : '—'}
                        </span>
                      )}
                      {rxVisit && (
                        <button
                          className="text-left flex flex-wrap items-center gap-1.5 hover:opacity-80"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDialogFor({ patient: p, visit: rxVisit })
                          }}
                        >
                          {rxVisit.prescription.slice(0, 2).map((rx, i) => (
                            <span key={i} className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[12px]">
                              {rx.drug || '—'}
                            </span>
                          ))}
                          {rxVisit.prescription.length > 2 && (
                            <span className="text-[12px] text-[var(--muted)]">+{rxVisit.prescription.length - 2} more</span>
                          )}
                          {rxVisit._id !== visit?._id && (
                            <span className="text-[var(--muted)] font-mono text-[11px] ml-2">
                              {formatDMY(rxVisit.createdAt)}
                            </span>
                          )}
                        </button>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
      {dialogFor && (
        <VisitDialog
          patient={dialogFor.patient}
          visit={dialogFor.visit}
          doctorName={resolveDoctor(dialogFor.visit.doctorId, doctorNames).name}
          department={resolveDoctor(dialogFor.visit.doctorId, doctorNames).department}
          onClose={() => setDialogFor(null)}
        />
      )}
    </Card>
  )
}
