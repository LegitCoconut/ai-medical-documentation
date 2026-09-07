'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, EmptyState, PageHeader, Th, Td } from '@/components/ui'
import type { Visit, Vitals, Patient } from '@/lib/types'

type VisitRow = Visit & { patient: Patient }

const COL_WIDTHS = ['8%', '22%', '26%', '24%', '8%', '12%']

function vitalsCompact(v: Vitals): string {
  const parts: string[] = []
  if (v.bp) parts.push(`BP ${v.bp}`)
  if (v.temp) parts.push(`T ${v.temp}`)
  if (v.pulse) parts.push(`P ${v.pulse}`)
  return parts.length ? parts.join(' · ') : '—'
}

function waitedMinutes(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
}

function todayDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function QueueTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 -mb-4">
      <table className="tbl table-fixed">
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <Th>Token</Th>
            <Th>Patient</Th>
            <Th>Complaint</Th>
            <Th>Vitals</Th>
            <Th>Waited</Th>
            <Th>{''}</Th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Row({ v, token, action }: { v: VisitRow; token: number; action: { label: string; onClick: () => void } }) {
  return (
    <tr>
      <Td>
        <span className="font-mono text-sm">#{token}</span>
      </Td>
      <Td>
        <div className="text-sm">{v.patient.name}</div>
        <div className="text-[11px] text-[var(--muted)] font-mono">
          {v.patient.mrn} · {v.patient.age}{v.patient.sex}
        </div>
      </Td>
      <Td>{v.reason}</Td>
      <Td>
        <span className="font-mono text-sm">{vitalsCompact(v.vitals)}</span>
      </Td>
      <Td>
        <span className="font-mono text-sm">{waitedMinutes(v.createdAt)}m</span>
      </Td>
      <Td>
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      </Td>
    </tr>
  )
}

function Section({
  label,
  rows,
  tokens,
  actionLabel,
  router,
}: {
  label: string
  rows: VisitRow[]
  tokens: Map<string, number>
  actionLabel: string
  router: ReturnType<typeof useRouter>
}) {
  if (rows.length === 0) return null
  return (
    <Card
      title={label}
      action={<span className="text-xs text-[var(--muted)]">{rows.length} patient{rows.length === 1 ? '' : 's'}</span>}
      className="mb-4"
    >
      <QueueTable>
        {rows.map((v) => (
          <Row
            key={v._id}
            v={v}
            token={tokens.get(v._id) ?? 0}
            action={{ label: actionLabel, onClick: () => router.push(`/doctor/visit/${v._id}`) }}
          />
        ))}
      </QueueTable>
    </Card>
  )
}

export function Queue({ initialVisits, meId }: { initialVisits: VisitRow[]; meId: string }) {
  const [visits, setVisits] = useState<VisitRow[]>(initialVisits)
  const router = useRouter()

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/visits?today=1')
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data.visits)) setVisits(data.visits)
      } catch {
        // ignore transient poll failures
      }
    }
    const id = setInterval(poll, 15000)
    return () => clearInterval(id)
  }, [])

  const oldestFirst = [...visits].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const tokens = new Map(oldestFirst.map((v, i) => [v._id, i + 1]))

  const waiting = oldestFirst.filter((v) => v.status === 'waiting')
  const inProgress = visits.filter((v) => v.status === 'in_progress' && v.doctorId === meId)
  const completed = visits.filter((v) => v.status === 'completed')

  const groups: { label: string; rows: VisitRow[]; actionLabel: string }[] = [
    { label: 'Waiting', rows: waiting, actionLabel: 'Start consultation' },
    { label: 'In progress', rows: inProgress, actionLabel: 'Resume' },
    { label: 'Completed today', rows: completed, actionLabel: 'View' },
  ]
  const anyRows = groups.some((g) => g.rows.length > 0)

  return (
    <div>
      <PageHeader
        title="Consultation queue"
        subtitle={todayDate()}
        right={<span className="text-sm text-[var(--muted)]">{waiting.length} waiting</span>}
      />
      {!anyRows ? (
        <Card>
          <EmptyState
            title="No patients in the queue."
            hint="Reception has not registered any visits today."
          />
        </Card>
      ) : (
        groups.map((g) => (
          <Section key={g.label} label={g.label} rows={g.rows} tokens={tokens} actionLabel={g.actionLabel} router={router} />
        ))
      )}
    </div>
  )
}
