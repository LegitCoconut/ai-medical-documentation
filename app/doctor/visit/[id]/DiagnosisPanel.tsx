'use client'

import { useState } from 'react'
import { Card, EmptyState, Tag } from '@/components/ui'
import type { DiagnosisItem } from '@/lib/types'

export function DiagnosisPanel({
  items,
  flashIds,
  onChange,
}: {
  items: DiagnosisItem[]
  flashIds: Set<string>
  onChange: (items: DiagnosisItem[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function commitEdit(id: string, text: string) {
    setEditingId(null)
    const trimmed = text.trim()
    if (!trimmed) return
    onChange(items.map((i) => (i.id === id ? { ...i, text: trimmed } : i)))
  }

  function addFinding() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onChange([
      ...items,
      { id: crypto.randomUUID(), text: trimmed, category: 'other', source: 'manual', at: new Date().toISOString() },
    ])
    setDraft('')
  }

  return (
    <Card title="Diagnosis">
      {items.length === 0 ? (
        <EmptyState title="Nothing recorded yet. Start dictation or type a finding." />
      ) : (
        <div>
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0 ${
                flashIds.has(item.id) ? 'flash-in' : ''
              }`}
            >
              {editingId === item.id ? (
                <input
                  autoFocus
                  defaultValue={item.text}
                  onBlur={(e) => commitEdit(item.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 bg-transparent outline-none text-sm border-b border-[var(--text)] py-0.5"
                />
              ) : (
                <span className="flex-1 text-sm cursor-text" onClick={() => setEditingId(item.id)}>
                  {item.text}
                </span>
              )}
              <Tag>{item.source === 'ai' ? 'AI' : 'MANUAL'}</Tag>
              <Tag>{item.category}</Tag>
              <button
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--text)] text-sm px-1 leading-none"
                aria-label="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') addFinding()
        }}
        placeholder="Add a finding…"
        className="w-full bg-transparent outline-none text-sm py-1.5 mt-1"
      />
    </Card>
  )
}
