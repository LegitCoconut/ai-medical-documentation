'use client'

import { useEffect, useRef } from 'react'
import { Button, StatusPill, Tag } from '@/components/ui'
import { PrescriptionSheet } from '@/app/doctor/visit/[id]/PrescriptionSheet'
import type { Patient, Visit, Vitals } from '@/lib/types'

const EMPTY_FLASH_IDS: Set<string> = new Set()

const VITAL_LABELS: [keyof Vitals, string, string][] = [
  ['bp', 'BP', 'mmHg'],
  ['temp', 'T', '°C'],
  ['pulse', 'P', '/min'],
  ['weight', 'W', 'kg'],
  ['spo2', 'SpO2', '%'],
]

function formatDMY(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function VisitDialog({
  patient,
  visit,
  doctorName,
  department,
  onClose,
}: {
  patient: Patient
  visit: Visit
  doctorName: string
  department: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const vitals = VITAL_LABELS.filter(([k]) => (visit.vitals[k] ?? '').trim())

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    dlg.showModal()
    const handleClose = () => onClose()
    dlg.addEventListener('close', handleClose)
    return () => dlg.removeEventListener('close', handleClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <dialog ref={ref} className="visit-dialog">
      <style>{`
        .visit-dialog {
          margin: auto;
          max-width: 900px;
          width: calc(100vw - 48px);
          max-height: calc(100vh - 80px);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0;
          background: var(--surface);
          color: var(--text);
        }
        /* scoped to [open] so it cannot beat the UA's dialog:not([open]) { display: none } */
        .visit-dialog[open] {
          display: flex;
          flex-direction: column;
        }
        .visit-dialog::backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
      `}</style>
      <div className="flex items-start justify-between gap-4 p-4 border-b border-[var(--border)] shrink-0">
        <div className="min-w-0">
          <div className="font-medium">
            {patient.name} <span className="font-mono text-sm text-[var(--muted)]">{patient.mrn}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
            <span className="font-mono">{formatDMY(visit.createdAt)}</span>
            <StatusPill status={visit.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="text-[var(--muted)] hover:text-[var(--text)] text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>

      <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
        {vitals.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 font-mono text-xs">
            {vitals.map(([k, label, unit]) => (
              <span key={k}>
                <span className="text-[var(--muted)]">{label} </span>
                {visit.vitals[k]}
                <span className="text-[var(--muted)]"> {unit}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mb-4">
          <h4 className="label-xs mb-2">Diagnosis / clinical findings</h4>
          {visit.diagnosis.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No findings recorded.</p>
          ) : (
            <div className="space-y-1">
              {visit.diagnosis.map((d, i) => (
                <div key={d.id} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-[var(--muted)]">{i + 1}.</span>
                  <Tag>{d.category}</Tag>
                  <span>{d.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {visit.notes && (
          <div className="mb-4">
            <h4 className="label-xs mb-2">Consultation notes</h4>
            <p className="text-sm whitespace-pre-line">{visit.notes}</p>
          </div>
        )}

        <PrescriptionSheet
          patient={patient}
          vitals={visit.vitals}
          status={visit.status}
          createdAt={visit.createdAt}
          prescription={visit.prescription}
          flashIds={EMPTY_FLASH_IDS}
          notes={visit.notes}
          doctorName={doctorName}
          department={department}
          readOnly
        />
      </div>

      <div className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border)] shrink-0">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="secondary" size="sm" onClick={() => ref.current?.close()}>
          Close
        </Button>
      </div>
    </dialog>
  )
}
