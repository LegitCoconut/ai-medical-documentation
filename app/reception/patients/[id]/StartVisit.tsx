'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Input, Textarea } from '@/components/ui'

export function StartVisit({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [bp, setBp] = useState('')
  const [temp, setTemp] = useState('')
  const [pulse, setPulse] = useState('')
  const [weight, setWeight] = useState('')
  const [spo2, setSpo2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (!reason.trim()) {
      setError('Complaint is required')
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
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start visit')
        return
      }
      router.push('/reception')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Start visit today">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Complaint">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
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
        {error && (
          <div className="bg-[#f4f4f4] border-l-2 border-black px-3 py-2 text-sm">{error}</div>
        )}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Starting…' : 'Start visit'}
        </Button>
      </form>
    </Card>
  )
}
