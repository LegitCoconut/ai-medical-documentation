'use client'

import { useState, useEffect, useRef } from 'react'

type TokenResult = {
  found: true
  mrn: string
  status: 'waiting' | 'in_progress' | 'completed'
  tokenNumber: number
  ahead: number
  totalWaiting: number
  totalToday: number
  reason: string
  registeredAt: string
} | {
  found: false
  message: string
}

const STATUS_CONFIG = {
  waiting: {
    label: 'Waiting',
    icon: '⏳',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)',
    hint: (ahead: number) =>
      ahead === 0
        ? 'You are next! Please be ready.'
        : `${ahead} patient${ahead > 1 ? 's' : ''} ahead of you.`,
  },
  in_progress: {
    label: 'With Doctor',
    icon: '🩺',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.3)',
    hint: () => 'Your consultation is currently in progress.',
  },
  completed: {
    label: 'Completed',
    icon: '✅',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.3)',
    hint: () => 'Your visit has been completed. Collect your prescription from reception.',
  },
}

export default function TokenPage() {
  const [mrn, setMrn] = useState('')
  const [result, setResult] = useState<TokenResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function check(mrnOverride?: string) {
    const mrnVal = (mrnOverride ?? mrn).trim().toUpperCase()
    if (!mrnVal) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/token-status?mrn=${encodeURIComponent(mrnVal)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      setResult(data)
      setLastChecked(new Date())
    } catch {
      setError('Could not connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 30 seconds when a result is visible
  useEffect(() => {
    if (result?.found) {
      pollingRef.current = setInterval(() => check(), 30_000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.found ? (result as { mrn: string }).mrn : null])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pollingRef.current) clearInterval(pollingRef.current)
    setResult(null)
    check()
  }

  function handleReset() {
    setResult(null)
    setMrn('')
    setError('')
    setLastChecked(null)
    if (pollingRef.current) clearInterval(pollingRef.current)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cfg = result?.found ? STATUS_CONFIG[result.status] : null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: '16px',
          background: 'rgba(139, 92, 246, 0.2)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          fontSize: '28px',
          marginBottom: '16px',
        }}>
          🏥
        </div>
        <h1 style={{
          color: '#f8fafc',
          fontSize: '26px',
          fontWeight: 700,
          margin: '0 0 8px',
          letterSpacing: '-0.5px',
        }}>
          Patient Token Status
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
          Check your queue position with your token number
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '32px',
        backdropFilter: 'blur(12px)',
      }}>
        {!result ? (
          /* Lookup form */
          <form onSubmit={handleSubmit}>
            <label style={{
              display: 'block',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Token / MRN Number
            </label>
            <input
              ref={inputRef}
              id="mrn-input"
              type="text"
              value={mrn}
              onChange={(e) => setMrn(e.target.value.toUpperCase())}
              placeholder="e.g. P-0001"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: '#f8fafc',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(139,92,246,0.7)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />

            {error && (
              <p style={{
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '12px',
                padding: '10px 12px',
                background: 'rgba(248,113,113,0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(248,113,113,0.2)',
              }}>
                {error}
              </p>
            )}

            <button
              id="check-token-btn"
              type="submit"
              disabled={loading || !mrn.trim()}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                background: loading || !mrn.trim()
                  ? 'rgba(139,92,246,0.3)'
                  : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || !mrn.trim() ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                boxShadow: loading || !mrn.trim() ? 'none' : '0 4px 15px rgba(124,58,237,0.4)',
              }}
            >
              {loading ? 'Checking…' : 'Check Status'}
            </button>
          </form>
        ) : !result.found ? (
          /* Not found */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h2 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>
              Token Not Found
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>
              {result.message}
            </p>
            <button
              id="try-again-btn"
              onClick={handleReset}
              style={{
                padding: '10px 24px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          /* Status result */
          <div>
            {/* Token badge */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                padding: '20px 32px',
                minWidth: '160px',
              }}>
                <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Token
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '40px',
                  fontWeight: 800,
                  color: '#f8fafc',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}>
                  #{result.tokenNumber}
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#64748b',
                  marginTop: '4px',
                }}>
                  {result.mrn}
                </span>
              </div>
            </div>

            {/* Status pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: cfg!.bg,
              border: `1px solid ${cfg!.border}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '28px' }}>{cfg!.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: cfg!.color, fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {cfg!.label}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '2px' }}>
                  {cfg!.hint(result.ahead)}
                </div>
              </div>
            </div>

            {/* Stats row */}
            {result.status === 'waiting' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '20px',
              }}>
                <StatBox label="Ahead of you" value={result.ahead === 0 ? 'None' : result.ahead.toString()} highlight={result.ahead === 0} />
                <StatBox label="Total waiting" value={result.totalWaiting.toString()} />
              </div>
            )}

            {/* Reason */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '20px',
            }}>
              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Reason for visit
              </span>
              <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>
                {result.reason}
              </p>
            </div>

            {/* Auto-refresh note & actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              {lastChecked && (
                <span style={{ color: '#475569', fontSize: '11px' }}>
                  Updated {lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto-refreshes
                </span>
              )}
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <button
                  id="refresh-btn"
                  onClick={() => check((result as { mrn: string }).mrn)}
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '…' : '↻ Refresh'}
                </button>
                <button
                  id="new-token-btn"
                  onClick={handleReset}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  New token
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p style={{ color: '#334155', fontSize: '12px', marginTop: '24px', textAlign: 'center' }}>
        This page auto-refreshes every 30 seconds · Please check in with reception if you have questions
      </p>
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: highlight ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px',
      padding: '14px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '24px',
        fontWeight: 800,
        fontFamily: 'monospace',
        color: highlight ? '#10b981' : '#f8fafc',
        lineHeight: 1,
        marginBottom: '4px',
      }}>
        {value}
      </div>
      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}
