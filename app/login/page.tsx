'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input } from '@/components/ui'

const roleHome: Record<string, string> = {
  admin: '/admin',
  reception: '/reception',
  doctor: '/doctor',
}

const DEMO_ACCOUNTS = [
  { role: 'Admin', creds: 'admin / admin123' },
  { role: 'Doctor', creds: 'dr.rao / doctor123' },
  { role: 'Reception', creds: 'reception / recep123' },
]

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      router.push(roleHome[data.role] || '/login')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-[380px]">
        <div className="card login-card px-8 pt-8 pb-7">
          <div className="text-center">
            <div className="inline-flex items-baseline gap-[3px]">
              <span className="text-[19px] font-semibold tracking-[0.04em]">PHC</span>
              <span className="text-[19px] font-normal tracking-[0.04em] text-[var(--muted)]">
                Consult
              </span>
            </div>
            <p className="label-xs mt-2">Primary Health Centre</p>
          </div>

          <div className="h-px bg-[var(--border)] my-6" />

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {error && <p className="text-[13px] text-[var(--text)] font-medium">{error}</p>}
            <Button type="submit" variant="primary" disabled={loading} className="mt-1">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <div className="card mt-4 px-5 py-4">
          <p className="label-xs mb-3">Demo accounts</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
            {DEMO_ACCOUNTS.flatMap((a) => [
              <span
                key={a.role}
                className="font-mono text-[12px] text-[var(--muted)] whitespace-nowrap"
              >
                {a.role}
              </span>,
              <span key={a.role + '-creds'} className="font-mono text-[12px]">
                {a.creds}
              </span>,
            ])}
          </div>
        </div>
      </div>
    </div>
  )
}
