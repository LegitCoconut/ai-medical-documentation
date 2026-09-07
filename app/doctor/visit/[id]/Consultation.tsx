'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, StatusPill, Textarea, Card } from '@/components/ui'
import type { DiagnosisItem, PrescriptionItem, Patient, Visit, Vitals } from '@/lib/types'
import { HistoryRail } from './HistoryRail'
import { DiagnosisPanel } from './DiagnosisPanel'
import { DictationPanel, type StructureResult } from './DictationPanel'
import { PrescriptionSheet } from './PrescriptionSheet'

export type HistoryVisit = Visit & { doctorName: string }

const FLASH_MS = 1000

export function Consultation({
  visit,
  patient,
  history,
  doctorName,
  department,
}: {
  visit: Visit
  patient: Patient
  history: HistoryVisit[]
  doctorName: string
  department: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(visit.status)
  const [vitals, setVitals] = useState<Vitals>(visit.vitals)
  const [diagnosis, setDiagnosis] = useState<DiagnosisItem[]>(visit.diagnosis)
  const [prescription, setPrescription] = useState<PrescriptionItem[]>(visit.prescription)
  const [notes, setNotes] = useState(visit.notes)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const [confirmComplete, setConfirmComplete] = useState(false)

  const startedRef = useRef(false)

  useEffect(() => {
    if (visit.status === 'waiting' && !startedRef.current) {
      startedRef.current = true
      fetch(`/api/visits/${visit._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.visit?.status) setStatus(d.visit.status)
        })
        .catch(() => {})
    }
  }, [visit._id, visit.status])

  function flash(id: string) {
    setFlashIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, FLASH_MS)
  }

  function handleDiagnosisChange(next: DiagnosisItem[]) {
    setDiagnosis(next)
    setDirty(true)
  }

  function handlePrescriptionChange(next: PrescriptionItem[]) {
    setPrescription(next)
    setDirty(true)
  }

  function handleVitalsChange(next: Vitals) {
    setVitals(next)
    setDirty(true)
  }

  function handleStructured(result: StructureResult) {
    const prevDiagIds = new Set(diagnosis.map((d) => d.id))
    const prevRxIds = new Set(prescription.map((p) => p.id))
    setVitals(result.vitals)
    setDiagnosis(result.diagnosis)
    setPrescription(result.prescription)
    result.diagnosis.filter((d) => !prevDiagIds.has(d.id)).forEach((d) => flash(d.id))
    result.prescription.filter((p) => !prevRxIds.has(p.id)).forEach((p) => flash(p.id))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/visits/${visit._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis, prescription, notes, vitals }),
      })
      if (res.ok) setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function doComplete() {
    setSaving(true)
    try {
      const res = await fetch(`/api/visits/${visit._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis, prescription, notes, vitals, status: 'completed' }),
      })
      if (res.ok) router.push('/doctor')
    } finally {
      setSaving(false)
    }
  }

  function onCompleteClick() {
    if (prescription.length === 0 && !confirmComplete) {
      setConfirmComplete(true)
      return
    }
    doComplete()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-104px)]">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4 shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold">{patient.name}</h1>
          <span className="font-mono text-sm text-[var(--muted)]">{patient.mrn}</span>
          <span className="text-sm text-[var(--muted)]">
            {patient.age} / {patient.sex}
          </span>
          <StatusPill status={status} />
        </div>
        <div className="flex items-center gap-3 no-print">
          {dirty && <span className="text-[11px] text-[var(--muted)]">Unsaved changes</span>}
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="secondary" onClick={save} disabled={saving}>
            Save
          </Button>
          <Button variant="primary" onClick={onCompleteClick} disabled={saving}>
            Complete visit
          </Button>
        </div>
      </div>

      {confirmComplete && (
        <div className="flex items-center justify-between border border-[var(--border-strong)] rounded px-3 py-2 mb-4 text-sm shrink-0 no-print">
          <span>No medicines have been added. Complete anyway?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirmComplete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={doComplete}>
              Complete anyway
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(620px,1.4fr)_340px_320px] gap-4">
        <div className="min-h-0 overflow-y-auto py-6 px-2">
          <PrescriptionSheet
            patient={patient}
            vitals={vitals}
            onVitalsChange={handleVitalsChange}
            status={status}
            createdAt={visit.createdAt}
            prescription={prescription}
            flashIds={flashIds}
            onPrescriptionChange={handlePrescriptionChange}
            notes={notes}
            doctorName={doctorName}
            department={department}
          />
        </div>

        <div className="min-h-0 overflow-y-auto space-y-4 no-print">
          <DiagnosisPanel items={diagnosis} flashIds={flashIds} onChange={handleDiagnosisChange} />
          <Card title="Consultation notes">
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setDirty(true)
              }}
              rows={4}
            />
          </Card>
          <Card title="Previous visits">
            <HistoryRail history={history} />
          </Card>
        </div>

        <div className="min-h-0 overflow-y-auto no-print">
          <DictationPanel
            visitId={visit._id}
            initialTranscript={visit.transcript}
            onStructured={handleStructured}
          />
        </div>
      </div>
    </div>
  )
}
