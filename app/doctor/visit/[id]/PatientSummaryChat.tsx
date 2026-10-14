'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui'

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: Date
  source?: 'llm' | 'structured'
}

type PatientMeta = {
  name: string
  mrn: string
  age: number
  sex: string
}

export function PatientSummaryChat({ patientId }: { patientId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientMeta, setPatientMeta] = useState<PatientMeta | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(question?: string) {
    const q = (question ?? input).trim()
    if (!q && messages.length === 0) {
      // Initial auto-summary
    } else if (!q) return

    const userMsg: Message | null = q
      ? { id: crypto.randomUUID(), role: 'user', text: q, ts: new Date() }
      : null

    if (userMsg) {
      setMessages((prev) => [...prev, userMsg])
      setInput('')
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/patients/${patientId}/summarise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q || undefined }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Server error ${res.status}`)
      }

      const data = await res.json()

      if (data.patient && !patientMeta) {
        setPatientMeta(data.patient)
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.text,
        ts: new Date(),
        source: data.source,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  const QUICK_QUESTIONS = [
    'Summarise history',
    'Any drug allergies or adverse reactions?',
    'Recent prescriptions',
    'Chronic conditions?',
    'Vitals trend',
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 4,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
            AI Patient Summary
          </div>
          {patientMeta && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {patientMeta.name} · {patientMeta.mrn}
            </div>
          )}
        </div>
        <button
          id="ai-summary-auto-btn"
          onClick={() => send('')}
          disabled={loading}
          title="Ask AI to summarise this patient"
          style={{
            fontSize: 11,
            padding: '4px 8px',
            background: 'var(--dark)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            fontWeight: 500,
          }}
        >
          {messages.length === 0 ? 'Auto-summarise' : '↻ Re-summarise'}
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              Ask the AI to summarise this patient&apos;s history,<br />
              or type a specific question below.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '92%',
              padding: '8px 11px',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: msg.role === 'user' ? 'var(--dark)' : 'var(--bg)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: 13,
              lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
            <div style={{
              fontSize: 10,
              color: 'var(--muted)',
              marginTop: 3,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}>
              <span>{msg.ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              {msg.source && (
                <span style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {msg.source === 'llm' ? 'AI' : 'structured'}
                </span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--muted)',
            fontSize: 12,
          }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--muted)',
              animation: 'pulse 1s infinite',
            }} />
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--muted)',
              animation: 'pulse 1s 0.2s infinite',
            }} />
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--muted)',
              animation: 'pulse 1s 0.4s infinite',
            }} />
            <span style={{ marginLeft: 4 }}>AI is thinking…</span>
          </div>
        )}

        {error && (
          <div style={{
            fontSize: 12,
            color: '#b91c1c',
            padding: '8px 10px',
            background: '#fef2f2',
            borderRadius: 6,
            border: '1px solid #fecaca',
          }}>
            ⚠ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {messages.length > 0 && (
        <div style={{
          padding: '8px 14px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          flexShrink: 0,
        }}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              id={`quick-q-${q.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => {
                setInput(q)
                textareaRef.current?.focus()
              }}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                cursor: 'pointer',
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          id="ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this patient… (Ctrl+Enter to send)"
          rows={2}
          className="input"
          style={{ fontSize: 13, resize: 'none', marginBottom: 8 }}
        />
        <Button
          id="ai-chat-send-btn"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={loading || !input.trim()}
          onClick={() => send()}
        >
          {loading ? 'Asking AI…' : 'Ask AI'}
        </Button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
