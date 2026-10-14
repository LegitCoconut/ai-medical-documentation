'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type TokenData = {
  found: true
  mrn: string
  status: 'waiting' | 'in_progress' | 'completed'
  tokenNumber: number
  ahead: number
  totalWaiting: number
  totalToday: number
  reason: string
  registeredAt: string
  doctorName?: string
  doctorDepartment?: string
}

type ErrorState = { valid: false; message: string }

const STATUS_CONFIG = {
  waiting: { label: 'Waiting', icon: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  in_progress: { label: 'With Doctor', icon: '🩺', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)' },
  completed: { label: 'Completed', icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)' },
}

export default function SignedTokenPage() {
  const searchParams = useSearchParams()
  const mrn = searchParams.get('mrn') ?? ''
  const visitId = searchParams.get('visitId') ?? ''
  const sig = searchParams.get('sig') ?? ''

  const [data, setData] = useState<TokenData | ErrorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function fetchStatus() {
    if (!mrn || !visitId || !sig) {
      setData({ valid: false, message: 'Invalid or missing link parameters.' })
      setLoading(false)
      return
    }
    try {
      const res = await fetch(
        `/api/token-status/signed?mrn=${encodeURIComponent(mrn)}&visitId=${encodeURIComponent(visitId)}&sig=${encodeURIComponent(sig)}`
      )
      const json = await res.json()
      if (!res.ok) {
        setData({ valid: false, message: json.error || 'Something went wrong.' })
      } else {
        setData(json)
        setLastUpdated(new Date())
      }
    } catch {
      setData({ valid: false, message: 'Could not reach server. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrn, visitId, sig])

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
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
          fontSize: 26, marginBottom: 14,
        }}>🏥</div>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: -0.4 }}>
          Your Appointment Status
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Live queue updates</p>
      </div>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 28,
        backdropFilter: 'blur(12px)',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ margin: 0, fontSize: 14 }}>Loading your appointment…</p>
          </div>
        )}

        {!loading && data && 'valid' in data && !data.valid && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: '#f8fafc', fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>Invalid Link</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>{data.message}</p>
            <a href="/token" style={{
              display: 'inline-block', padding: '10px 20px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: '#f8fafc', textDecoration: 'none', fontSize: 13, fontWeight: 500,
            }}>Check status manually →</a>
          </div>
        )}

        {!loading && data && 'found' in data && !data.found && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>No visit found for today.</p>
          </div>
        )}

        {!loading && data && 'status' in data && (
          <TokenView data={data} lastUpdated={lastUpdated} onRefresh={fetchStatus} />
        )}
      </div>

      <p style={{ color: '#334155', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        Auto-refreshes every 30 seconds · <a href="/token" style={{ color: '#475569', textDecoration: 'none' }}>Open public check-in</a>
      </p>
    </div>
  )
}

function TokenView({ data, lastUpdated, onRefresh }: { data: TokenData; lastUpdated: Date | null; onRefresh: () => void }) {
  const cfg = STATUS_CONFIG[data.status]
  const time = new Date(data.registeredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div>
      {/* Token badge */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '18px 28px', minWidth: 150,
        }}>
          <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Token</span>
          <span style={{ fontFamily: 'monospace', fontSize: 46, fontWeight: 800, color: '#f8fafc', letterSpacing: -1, lineHeight: 1 }}>
            #{data.tokenNumber}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b', marginTop: 3 }}>{data.mrn}</span>
        </div>
      </div>

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 10, padding: '13px 14px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 24 }}>{cfg.icon}</span>
        <div>
          <div style={{ color: cfg.color, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</div>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 1 }}>
            {data.status === 'waiting'
              ? data.ahead === 0 ? 'You\'re next! Please be ready.' : `${data.ahead} patient${data.ahead > 1 ? 's' : ''} ahead of you`
              : data.status === 'in_progress' ? 'Your consultation is in progress'
              : 'Collect your prescription from reception'}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Reason', value: data.reason },
          data.doctorName ? { label: 'Doctor', value: `Dr. ${data.doctorName}${data.doctorDepartment ? ` · ${data.doctorDepartment}` : ''}` } : null,
          { label: 'Registered at', value: time },
          data.status === 'waiting' ? { label: 'Ahead of you', value: data.ahead === 0 ? 'None — you\'re next!' : String(data.ahead) } : null,
          data.status === 'waiting' ? { label: 'Total waiting', value: String(data.totalWaiting) } : null,
        ].filter(Boolean).map((row) => (
          <div key={row!.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13,
          }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>{row!.label}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{row!.value}</span>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {lastUpdated && (
          <span style={{ color: '#475569', fontSize: 10 }}>
            Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <button
          onClick={onRefresh}
          style={{
            marginLeft: 'auto', padding: '7px 12px', fontSize: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, color: '#94a3b8', cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}
