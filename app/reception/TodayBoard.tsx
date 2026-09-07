'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, EmptyState, StatusPill, Table, Td, Th } from '@/components/ui'
import type { Patient, Visit } from '@/lib/types'

type BoardVisit = Visit & { patient: Patient | null }

function vitalsLine(v: Visit['vitals']): string {
  const parts: string[] = []
  if (v.bp) parts.push(`BP ${v.bp}`)
  if (v.temp) parts.push(`T ${v.temp}`)
  if (v.pulse) parts.push(`P ${v.pulse}`)
  if (v.weight) parts.push(`Wt ${v.weight}`)
  if (v.spo2) parts.push(`SpO2 ${v.spo2}`)
  return parts.length ? parts.join(' · ') : '—'
}

function todayDate(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function TodayBoard({ initialVisits }: { initialVisits: BoardVisit[] }) {
  const router = useRouter()
  const [visits, setVisits] = useState(initialVisits)

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/visits?today=1')
        if (!res.ok) return
        const data = await res.json()
        setVisits(data.visits)
      } catch {
        // ignore transient errors, next tick retries
      }
    }, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <Card title="Today's visits" action={<span className="text-xs text-[var(--muted)] font-mono">{todayDate()}</span>}>
      {!visits.length ? (
        <EmptyState title="No visits registered today." />
      ) : (
        <div className="-mx-4 -mb-4">
          <Table>
            <thead>
              <tr>
                <Th>MRN</Th>
                <Th>Patient</Th>
                <Th>Age/Sex</Th>
                <Th>Complaint</Th>
                <Th>Vitals</Th>
                <Th>Status</Th>
                <Th>Time</Th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr
                  key={v._id}
                  className="cursor-pointer hover:bg-[#f7f7f7]"
                  onClick={() => router.push(`/reception/patients/${v.patientId}`)}
                >
                  <Td>
                    <span className="font-mono">{v.patient?.mrn ?? '—'}</span>
                  </Td>
                  <Td>{v.patient?.name ?? '—'}</Td>
                  <Td>
                    {v.patient ? `${v.patient.age}/${v.patient.sex}` : '—'}
                  </Td>
                  <Td>{v.reason}</Td>
                  <Td>
                    <span className="font-mono text-[12px] text-[var(--muted)]">{vitalsLine(v.vitals)}</span>
                  </Td>
                  <Td>
                    <StatusPill status={v.status} />
                  </Td>
                  <Td>
                    <span className="font-mono">
                      {new Date(v.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  )
}
