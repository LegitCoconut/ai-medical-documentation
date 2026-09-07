'use client'

import { useState } from 'react'
import type { HistoryVisit } from './Consultation'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PreviousVisit({ v, defaultOpen }: { v: HistoryVisit; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[var(--border)] last:border-0 py-2">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left gap-2">
        <span className="text-sm">
          {formatDate(v.completedAt ?? v.createdAt)} · {v.doctorName}
        </span>
        <span className="font-mono text-[11px] text-[var(--muted)] shrink-0">
          {v.diagnosis.length} dx · {v.prescription.length} rx
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {v.diagnosis.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No diagnosis recorded.</p>
          ) : (
            <ul className="text-sm space-y-0.5">
              {v.diagnosis.map((d) => (
                <li key={d.id}>{d.text}</li>
              ))}
            </ul>
          )}
          {v.prescription.length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {v.prescription.map((p) => (
                  <tr key={p.id}>
                    <td className="pr-2 py-0.5">{p.drug}</td>
                    <td className="pr-2 py-0.5 text-[var(--muted)]">{p.dose}</td>
                    <td className="pr-2 py-0.5 text-[var(--muted)]">{p.frequency}</td>
                    <td className="text-[var(--muted)]">{p.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export function HistoryRail({ history }: { history: HistoryVisit[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No previous visits on record.</p>
  }
  return (
    <div>
      {history.map((v, i) => (
        <PreviousVisit key={v._id} v={v} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
