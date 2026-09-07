'use client'

import { Fragment, FormEvent, ReactNode, useState } from 'react'
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Table, Td, Th } from '@/components/ui'
import type { Role, User } from '@/lib/types'

const ROLE_FILTERS: { label: string; value: 'all' | Role }[] = [
  { label: 'All', value: 'all' },
  { label: 'Doctors', value: 'doctor' },
  { label: 'Reception', value: 'reception' },
  { label: 'Admin', value: 'admin' },
]

const EMPTY_FORM = { name: '', username: '', password: '', role: 'doctor' as Role, department: '' }

function ErrorBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#f4f4f4] border-l-2 border-[#0a0a0a] text-[#0a0a0a] text-sm px-3 py-2 mb-3">
      {children}
    </div>
  )
}

async function readJson(res: Response) {
  return res.json().catch(() => ({}))
}

export function StaffManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [resetRowId, setResetRowId] = useState<string | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    const res = await fetch('/api/users')
    const data = await readJson(res)
    if (!res.ok) {
      setListError(data.error || 'Failed to load users')
      return
    }
    setUsers(data.users)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await readJson(res)
    setCreating(false)
    if (!res.ok) {
      setFormError(data.error || 'Failed to create account')
      return
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    await reload()
  }

  async function toggleActive(u: User) {
    setListError(null)
    setBusyId(u._id)
    const res = await fetch(`/api/users/${u._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    const data = await readJson(res)
    setBusyId(null)
    if (!res.ok) {
      setListError(data.error || 'Failed to update account')
      return
    }
    await reload()
  }

  async function submitReset(u: User) {
    if (resetPwd.length < 6) {
      setListError('Password must be at least 6 characters')
      return
    }
    setListError(null)
    setBusyId(u._id)
    const res = await fetch(`/api/users/${u._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPwd }),
    })
    const data = await readJson(res)
    setBusyId(null)
    if (!res.ok) {
      setListError(data.error || 'Failed to reset password')
      return
    }
    setResetRowId(null)
    setResetPwd('')
    await reload()
  }

  const filtered = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)

  return (
    <div>
      <PageHeader
        title="Staff accounts"
        subtitle="Doctor and reception logins for this centre."
        right={
          <Button
            variant="primary"
            onClick={() => {
              setShowForm((v) => !v)
              setFormError(null)
            }}
          >
            New account
          </Button>
        }
      />

      {showForm && (
        <Card title="New account" className="mb-4">
          <form onSubmit={handleCreate}>
            {formError && <ErrorBar>{formError}</ErrorBar>}
            <div className="grid grid-cols-5 gap-3">
              <Field label="Full name">
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Username">
                <Input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </Field>
              <Field label="Password">
                <Input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <Field label="Role">
                <Select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  <option value="doctor">Doctor</option>
                  <option value="reception">Reception</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Field label="Department">
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setFormError(null)
                  setForm(EMPTY_FORM)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {listError && <ErrorBar>{listError}</ErrorBar>}

      <Card
        title="Accounts"
        action={
          <div className="flex gap-1.5">
            {ROLE_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={roleFilter === f.value ? 'primary' : 'secondary'}
                onClick={() => setRoleFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState title="No accounts" hint="Try a different filter or create a new account." />
        ) : (
          <div className="-mx-4 -mb-4">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Username</Th>
                  <Th>Role</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <Fragment key={u._id}>
                    <tr>
                      <Td>{u.name}</Td>
                      <Td>
                        <span className="font-mono">{u.username}</span>
                      </Td>
                      <Td>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                          {u.role}
                        </span>
                      </Td>
                      <Td>{u.department || '—'}</Td>
                      <Td>
                        <span className={`pill ${u.active ? 'pill-dark' : 'pill-muted'}`}>
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === u._id}
                            onClick={() => {
                              setResetRowId(resetRowId === u._id ? null : u._id)
                              setResetPwd('')
                              setListError(null)
                            }}
                          >
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === u._id}
                            onClick={() => toggleActive(u)}
                          >
                            {u.active ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                    {resetRowId === u._id && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2 border-b border-[var(--border)]">
                          <div className="flex items-center gap-2">
                            <Input
                              type="password"
                              placeholder="New password (6+ chars)"
                              value={resetPwd}
                              onChange={(e) => setResetPwd(e.target.value)}
                              className="max-w-xs"
                            />
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busyId === u._id}
                              onClick={() => submitReset(u)}
                            >
                              Save password
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setResetRowId(null)
                                setResetPwd('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
