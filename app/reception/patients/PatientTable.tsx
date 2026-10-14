'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input, EmptyState, Table, Th, Td } from '@/components/ui'
import type { Patient } from '@/lib/types'

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function PatientTable({ initialPatients }: { initialPatients: Patient[] }) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'mrn' | 'age' | 'createdAt'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = query
      ? initialPatients.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.mrn.toLowerCase().includes(query) ||
            p.phone.includes(query) ||
            (p.address?.toLowerCase().includes(query) ?? false)
        )
      : [...initialPatients]

    list.sort((a, b) => {
      let av: string | number = a[sortKey] ?? ''
      let bv: string | number = b[sortKey] ?? ''
      if (sortKey === 'age') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [initialPatients, q, sortKey, sortDir])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}> ↕</span>
    return <span>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
  }

  const query = q.trim()

  return (
    <div>
      <div style={{ marginBottom: 16, maxWidth: 400 }}>
        <Input
          id="patient-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, MRN or phone…"
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? 'No patients match that search.' : 'No patients registered yet.'}
          hint={query ? undefined : 'Use the "Register patient" button to add one.'}
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('mrn')}
                  >
                    MRN <SortIcon k="mrn" />
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('name')}
                  >
                    Name <SortIcon k="name" />
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('age')}
                  >
                    Age/Sex <SortIcon k="age" />
                  </th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Allergies</th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('createdAt')}
                  >
                    Registered <SortIcon k="createdAt" />
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p._id}
                    style={{ cursor: 'pointer' }}
                    className="hover:bg-[#f7f7f7]"
                  >
                    <td>
                      <span className="font-mono text-[12px]">
                        {highlight(p.mrn, q)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {highlight(p.name, q)}
                    </td>
                    <td className="font-mono text-[12px]">
                      {p.age}/{p.sex}
                    </td>
                    <td>
                      <span className="font-mono text-[12px] text-[var(--muted)]">
                        {highlight(p.phone, q)}
                      </span>
                    </td>
                    <td className="text-[var(--muted)]">
                      {p.address ? highlight(p.address, q) : '—'}
                    </td>
                    <td>
                      {p.allergies ? (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            background: '#fef9c3',
                            border: '1px solid #fde68a',
                            borderRadius: 4,
                            color: '#78350f',
                          }}
                        >
                          {p.allergies}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="font-mono text-[12px] text-[var(--muted)]">
                      {new Date(p.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td>
                      <Link
                        href={`/reception/patients/${p._id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        View / Start visit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--muted)',
              }}
            >
              {filtered.length} of {initialPatients.length} patients
            </div>
          )}
        </div>
      )}
    </div>
  )
}
