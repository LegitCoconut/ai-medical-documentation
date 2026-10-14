'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import type { User } from '@/lib/types'

type Doctor = Pick<User, '_id' | 'name' | 'department'>

export function StartVisit({ patientId, patientEmail }: { patientId: string; patientEmail?: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [bp, setBp] = useState('')
  const [temp, setTemp] = useState('')
  const [pulse, setPulse] = useState('')
  const [weight, setWeight] = useState('')
  const [spo2, setSpo2] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [email, setEmail] = useState(patientEmail ?? '')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ tokenNumber: number; emailSent: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/users/doctors')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.doctors)) setDoctors(d.doctors)
      })
      .catch(() => {})
  }, [])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (!reason.trim()) {
      setError('Complaint / reason is required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          reason,
          vitals: { bp, temp, pulse, weight, spo2 },
          doctorId: doctorId || null,
          patientEmail: email.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start visit')
        return
      }
      setSuccess({
        tokenNumber: data.tokenNumber,
        emailSent: data.emailStatus?.sent === true,
      })
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card title="Visit started">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)', marginBottom: 6 }}>
            #{success.tokenNumber}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Token number assigned</div>
          {success.emailSent ? (
            <div style={{ fontSize: 13, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              ✓ Appointment confirmation sent to {email}
            </div>
          ) : email ? (
            <div style={{ fontSize: 13, color: '#854d0e', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              ⚠ Email could not be sent — SMTP may not be configured
            </div>
          ) : null}
          <Button variant="secondary" onClick={() => router.push('/reception')} style={{ width: '100%', marginTop: 4 }}>
            ← Back to reception
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Start visit today">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Complaint / Reason">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chief complaint or reason for visit" />
        </Field>

        <Field label="Assign Doctor (optional)">
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">— Unassigned (any doctor) —</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                Dr. {d.name}{d.department ? ` · ${d.department}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Patient Email (for appointment confirmation)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="patient@example.com"
          />
        </Field>

        <details style={{ fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)', marginBottom: 8, userSelect: 'none' }}>
            Vitals (optional)
          </summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Field label="BP">
              <Input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80" />
            </Field>
            <Field label="Temp °C">
              <Input value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="37.0" />
            </Field>
            <Field label="Pulse">
              <Input value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="80" />
            </Field>
            <Field label="Weight kg">
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="60" />
            </Field>
            <Field label="SpO2 %">
              <Input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" />
            </Field>
          </div>
        </details>

        {error && (
          <div className="bg-[#f4f4f4] border-l-2 border-black px-3 py-2 text-sm">{error}</div>
        )}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Starting…' : 'Start visit & assign token'}
        </Button>
      </form>
    </Card>
  )
}
