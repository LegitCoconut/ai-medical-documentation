'use client'

import type { Patient, Vitals, PrescriptionItem, Visit } from '@/lib/types'

const FREQ_EXPANSIONS: Record<string, string> = {
  OD: 'once daily',
  BD: 'twice daily',
  TDS: 'three times daily',
  QID: 'four times daily',
  HS: 'at bedtime',
  SOS: 'as needed',
  STAT: 'immediately',
}

function freqExpansion(freq: string): string {
  const expansion = FREQ_EXPANSIONS[freq.trim().toUpperCase()]
  return expansion ? `(${expansion})` : ''
}

function formatDMY(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const vitalRows: [keyof Vitals, string, string][] = [
  ['bp', 'BP', 'mmHg'],
  ['temp', 'TEMP', '°C'],
  ['pulse', 'PULSE', '/min'],
  ['weight', 'WEIGHT', 'kg'],
  ['spo2', 'SPO2', '%'],
]

const inputBase =
  'bg-transparent border-0 border-b border-transparent focus:border-[var(--text)] outline-none'

function emptyItem(): PrescriptionItem {
  return {
    id: crypto.randomUUID(),
    drug: '',
    dose: '',
    frequency: '',
    duration: '',
    notes: '',
    source: 'manual',
    at: new Date().toISOString(),
  }
}

function Cell({ value, className, dash }: { value: string; className?: string; dash?: boolean }) {
  const empty = !value.trim()
  return (
    <span className={`${className ?? ''} ${dash && empty ? 'text-[var(--muted)]' : ''}`}>
      {dash && empty ? '—' : value}
    </span>
  )
}

export function PrescriptionSheet({
  patient,
  vitals,
  onVitalsChange,
  status,
  createdAt,
  prescription,
  flashIds,
  onPrescriptionChange,
  notes,
  doctorName,
  department,
  readOnly = false,
}: {
  patient: Patient
  vitals: Vitals
  onVitalsChange?: (v: Vitals) => void
  status: Visit['status']
  createdAt: string
  prescription: PrescriptionItem[]
  flashIds: Set<string>
  onPrescriptionChange?: (items: PrescriptionItem[]) => void
  notes: string
  doctorName: string
  department: string
  readOnly?: boolean
}) {
  const hasVitals = vitalRows.some(([k]) => (vitals[k] ?? '').trim())

  function updateVital(k: keyof Vitals, value: string) {
    onVitalsChange?.({ ...vitals, [k]: value })
  }

  function update(id: string, field: keyof PrescriptionItem, value: string) {
    onPrescriptionChange?.(prescription.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  function remove(id: string) {
    onPrescriptionChange?.(prescription.filter((p) => p.id !== id))
  }

  function add() {
    onPrescriptionChange?.([...prescription, emptyItem()])
  }

  return (
    <div
      className="rx-sheet bg-white border border-[var(--border)] mx-auto p-8"
      style={{ maxWidth: 760, fontSize: 13 }}
    >
      <div className="flex items-start justify-between pb-3 border-b-2 border-black">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.08em' }}>PRIMARY HEALTH CENTRE</div>
          <div className="text-[var(--muted)] mt-1">Department of Health &amp; Family Welfare</div>
        </div>
        <div className="text-right">
          <div className="label-xs">Outpatient Prescription</div>
          <div className="font-mono text-[var(--muted)] mt-1">{formatDMY(createdAt)}</div>
        </div>
      </div>

      <div className="flex items-start justify-between py-3 border-b border-[var(--border)]">
        <div>
          <div className="font-medium">{doctorName || '—'}</div>
          {department && <div className="text-[var(--muted)] text-xs mt-0.5">{department}</div>}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
          <span className="text-[var(--muted)]">OP No.</span>
          <span>{patient.mrn}</span>
          <span className="text-[var(--muted)]">Date</span>
          <span>{formatDMY(createdAt)}</span>
          <span className="text-[var(--muted)]">Time</span>
          <span>{formatTime(createdAt)}</span>
        </div>
      </div>

      <div className="mt-4 border border-[var(--border)] rounded p-3">
        <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Name</span>
          <span className="font-medium">{patient.name}</span>
          <span className="text-[var(--muted)]">Age / Sex</span>
          <span>
            {patient.age} / {patient.sex}
          </span>
          <span className="text-[var(--muted)]">MRN</span>
          <span className="font-mono">{patient.mrn}</span>
          <span className="text-[var(--muted)]">Phone</span>
          <span className="font-mono">{patient.phone}</span>
          {patient.address && (
            <>
              <span className="text-[var(--muted)]">Address</span>
              <span className="col-span-3">{patient.address}</span>
            </>
          )}
        </div>
        {patient.allergies && (
          <div className="mt-2 pt-2 border-t border-[var(--border)] border-l-2 border-l-black pl-2">
            <div className="label-xs mb-0.5">Allergies</div>
            <div className="font-medium text-sm">{patient.allergies}</div>
          </div>
        )}
      </div>

      {hasVitals && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 pt-3 border-t border-[var(--border)] font-mono text-xs">
          {vitalRows.map(([k, label, unit]) => (
            <span key={k} className="flex items-baseline gap-1">
              <span className="text-[var(--muted)]">{label}</span>
              {readOnly ? (
                <Cell value={vitals[k] ?? ''} dash />
              ) : (
                <input
                  value={vitals[k] ?? ''}
                  onChange={(e) => updateVital(k, e.target.value)}
                  size={Math.max((vitals[k] ?? '').length, 3)}
                  className={inputBase}
                />
              )}
              <span className="text-[var(--muted)]">{unit}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex items-baseline gap-2 mb-3">
          <span style={{ fontSize: 28, fontFamily: 'serif', lineHeight: 1 }}>℞</span>
          <span className="label-xs">Medicines</span>
        </div>
        {prescription.length === 0 && <p className="text-sm text-[var(--muted)] mb-2">No medicines prescribed.</p>}
        {prescription.length > 0 && (
          <div>
            {prescription.map((p, i) => (
              <div
                key={p.id}
                className={`group py-2 border-b border-[var(--border)] last:border-0 ${flashIds.has(p.id) ? 'flash-in' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-1 flex-1 min-w-0">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{i + 1}.</span>
                    {readOnly ? (
                      <Cell value={p.drug} className="flex-1 min-w-0" />
                    ) : (
                      <input
                        value={p.drug}
                        onChange={(e) => update(p.id, 'drug', e.target.value)}
                        placeholder="Drug name"
                        style={{ fontSize: 15, fontWeight: 600 }}
                        className={`${inputBase} flex-1 min-w-0`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {readOnly ? (
                      <Cell value={p.duration} className="font-mono text-xs text-[var(--muted)] text-right w-20" />
                    ) : (
                      <>
                        <input
                          value={p.duration}
                          onChange={(e) => update(p.id, 'duration', e.target.value)}
                          placeholder="Duration"
                          className={`${inputBase} font-mono text-xs text-[var(--muted)] text-right w-20`}
                        />
                        <button
                          onClick={() => remove(p.id)}
                          className="no-print opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--text)] text-sm px-1 leading-none"
                          aria-label="Remove medicine"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="pl-5 mt-0.5 flex items-center flex-wrap gap-x-1 text-[12px] text-[var(--muted)]">
                  {readOnly ? (
                    <Cell value={p.dose} />
                  ) : (
                    <input
                      value={p.dose}
                      onChange={(e) => update(p.id, 'dose', e.target.value)}
                      placeholder="dose"
                      size={Math.max(p.dose.length, 4)}
                      className={inputBase}
                    />
                  )}
                  <span>·</span>
                  {readOnly ? (
                    <Cell value={p.frequency} />
                  ) : (
                    <input
                      value={p.frequency}
                      onChange={(e) => update(p.id, 'frequency', e.target.value)}
                      placeholder="frequency"
                      size={Math.max(p.frequency.length, 3)}
                      className={inputBase}
                    />
                  )}
                  {freqExpansion(p.frequency) && <span>{freqExpansion(p.frequency)}</span>}
                  <span>·</span>
                  {readOnly ? (
                    <Cell value={p.notes} className="flex-1 min-w-[100px]" />
                  ) : (
                    <input
                      value={p.notes}
                      onChange={(e) => update(p.id, 'notes', e.target.value)}
                      placeholder="notes"
                      className={`${inputBase} flex-1 min-w-[100px]`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <button onClick={add} className="no-print mt-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            + Add medicine
          </button>
        )}
      </div>

      {notes && (
        <div className="mt-4 pt-3 border-t border-[var(--border)]">
          <div className="label-xs mb-1">Advice</div>
          <p className="text-sm whitespace-pre-line">{notes}</p>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <div style={{ width: 220 }}>
          <div style={{ height: 132 }} />
          <div className="border-t border-[var(--border-strong)] pt-1 text-center">
            <div className="text-[11px]">{doctorName || '—'}</div>
            <div className="text-[11px] text-[var(--muted)]">Signature</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="no-print text-[11px] text-[var(--muted)]">
          Drafted from the consulting doctor&apos;s dictation and reviewed before saving.
        </p>
        {status !== 'completed' && (
          <span className="no-print border border-[var(--border-strong)] rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide shrink-0">
            DRAFT
          </span>
        )}
      </div>
    </div>
  )
}
