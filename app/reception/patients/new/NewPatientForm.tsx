'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'

type Errors = Partial<Record<'name' | 'age' | 'sex' | 'phone', string>>

export function NewPatientForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('M')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [allergies, setAllergies] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Name is required'
    const ageNum = Number(age)
    if (!age || !Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
      e.age = 'Enter an integer age between 0 and 120'
    }
    if (!['M', 'F', 'O'].includes(sex)) e.sex = 'Select a sex'
    if (phone.replace(/\D/g, '').length < 10) e.phone = 'Enter at least 10 digits'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setServerError('')
    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age: Number(age), sex, phone, address, allergies }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error || 'Failed to register patient')
        return
      }
      router.push(`/reception/patients/${data.patient._id}`)
    } catch {
      setServerError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-[720px]">
      {serverError && (
        <div className="mb-4 bg-[#f4f4f4] border-l-2 border-black px-3 py-2 text-sm">
          {serverError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Age" error={errors.age}>
          <Input type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
        </Field>
        <Field label="Sex" error={errors.sex}>
          <Select value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </Select>
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Address">
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Known allergies">
            <Textarea
              rows={2}
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Leave blank if none"
            />
          </Field>
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={loading} className="mt-5">
        {loading ? 'Registering…' : 'Register patient'}
      </Button>
    </form>
  )
}
