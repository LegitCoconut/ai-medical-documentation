'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, EmptyState, Input } from '@/components/ui'
import type { Patient } from '@/lib/types'

export function PatientSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Patient[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setResults(null)
      return
    }
    setLoading(true)
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(res.ok ? data.patients : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  return (
    <Card title="Find a patient">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, MRN or phone"
        className="mb-4"
      />
      {results === null ? (
        <EmptyState title="Type to search for a patient." />
      ) : loading ? null : results.length === 0 ? (
        <EmptyState
          title="No patient matches that name, MRN or phone."
          hint="Register them from the New patient page."
        />
      ) : (
        <div className="-mx-4 -mb-4 divide-y divide-[var(--border)]">
          {results.map((p) => (
            <Link
              key={p._id}
              href={`/reception/patients/${p._id}`}
              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-[#f7f7f7]"
            >
              <span>{p.name}</span>
              <span className="font-mono text-[var(--muted)]">{p.mrn}</span>
              <span className="text-[var(--muted)]">
                {p.age}/{p.sex}
              </span>
              <span className="font-mono text-[var(--muted)]">{p.phone}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
