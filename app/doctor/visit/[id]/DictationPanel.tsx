'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import type { DiagnosisItem, PrescriptionItem, Vitals } from '@/lib/types'

type Chunk = { id: string; text: string; at: string }
type Mode = 'mic' | 'text'

export type StructureResult = {
  vitals: Vitals
  diagnosis: DiagnosisItem[]
  prescription: PrescriptionItem[]
  added: { diagnosis: number; prescription: number; vitals: number }
  source: 'rules' | 'llm'
}

type SRAlternative = { transcript: string }
type SRResult = { isFinal: boolean; 0: SRAlternative }
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SREvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type SRWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }

function summaryLine(added: StructureResult['added']): string {
  const { diagnosis, prescription, vitals } = added
  if (!diagnosis && !prescription && !vitals) return 'Nothing new found in that transcript.'
  const plur = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`
  return `Added ${plur(diagnosis, 'finding')}, ${plur(prescription, 'medicine')}, ${plur(vitals, 'vital')}`
}

export function DictationPanel({
  visitId,
  initialTranscript,
  onStructured,
}: {
  visitId: string
  initialTranscript: Chunk[]
  onStructured: (result: StructureResult) => void
}) {
  const [mode, setMode] = useState<Mode>('mic')
  const [sttSupported, setSttSupported] = useState(false)
  const [live, setLive] = useState(false)
  const [structuring, setStructuring] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [textDraft, setTextDraft] = useState('')
  const [chunks, setChunks] = useState<Chunk[]>(initialTranscript)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<{ text: string; source: StructureResult['source'] } | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // feature-detect only in the browser — never at module scope, must not run during SSR
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    setSttSupported(!!SR)
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [chunks, interimText])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  function appendChunk(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setChunks((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, at: new Date().toISOString() }])
  }

  function showSummary(data: StructureResult) {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current)
    setSummary({ text: summaryLine(data.added), source: data.source })
    summaryTimerRef.current = setTimeout(() => setSummary(null), 5000)
  }

  function handleStart() {
    if (structuring || live) return
    setError('')
    if (mode === 'mic') {
      if (!sttSupported) return
      const w = window as SRWindow
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!SR) return
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-IN'
      rec.onresult = (e: SREvent) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) appendChunk(res[0].transcript)
          else interim += res[0].transcript
        }
        setInterimText(interim)
      }
      rec.onend = () => {
        recognitionRef.current = null
      }
      rec.start()
      recognitionRef.current = rec
    }
    setLive(true)
  }

  async function handleStop() {
    if (structuring) return
    let pending = chunks
    if (mode === 'mic') {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setInterimText('')
    } else {
      const trimmed = textDraft.trim()
      if (trimmed) {
        pending = [...chunks, { id: crypto.randomUUID(), text: trimmed, at: new Date().toISOString() }]
        setChunks(pending)
        setTextDraft('')
      }
    }

    const transcript = pending.map((c) => c.text).join('\n')
    if (!transcript.trim()) {
      setLive(false)
      return
    }

    setStructuring(true)
    setError('')
    try {
      const res = await fetch(`/api/visits/${visitId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      if (!res.ok) throw new Error('structure failed')
      const data: StructureResult = await res.json()
      onStructured(data)
      setLive(false)
      showSummary(data)
    } catch {
      setError('Structuring failed — press Stop to retry. Your transcript is safe.')
    } finally {
      setStructuring(false)
    }
  }

  function submitTextChunk() {
    if (!live) return
    if (!textDraft.trim()) return
    appendChunk(textDraft)
    setTextDraft('')
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="label-xs mb-2">Live transcript</h3>
      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto border border-[var(--border)] rounded p-2 mb-2 bg-[var(--surface)]">
        {chunks.length === 0 && !interimText ? (
          <p className="text-sm text-[var(--muted)]">Nothing heard yet.</p>
        ) : (
          <div className="font-mono text-[12px] leading-[1.6]">
            {chunks.map((c) => (
              <div key={c.id}>
                <span className="text-[var(--muted)]">{new Date(c.at).toLocaleTimeString('en-GB', { hour12: false })}</span>{' '}
                {c.text}
              </div>
            ))}
            {interimText && <div className="italic text-[var(--muted)]">{interimText}</div>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] mb-3 min-h-4">
        {structuring && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse" />
            <span>Structuring transcript…</span>
          </>
        )}
        {!structuring && summary && (
          <>
            <span>{summary.text}</span>
            <span className="text-[var(--muted)]">via {summary.source === 'llm' ? 'model' : 'rules'}</span>
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-[var(--muted)] mb-2">{error}</p>}

      <div className="flex border border-[var(--border-strong)] rounded overflow-hidden mb-3 text-sm">
        <button
          onClick={() => setMode('mic')}
          disabled={!sttSupported}
          className={`flex-1 py-1.5 ${mode === 'mic' ? 'bg-[var(--dark)] text-white' : 'bg-[var(--surface)]'} disabled:opacity-40`}
        >
          Mic
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-1.5 border-l border-[var(--border-strong)] ${mode === 'text' ? 'bg-[var(--dark)] text-white' : 'bg-[var(--surface)]'}`}
        >
          Text
        </button>
      </div>

      {mode === 'mic' && (
        <p className="text-[11px] text-[var(--muted)] mb-3">Placeholder for the local Whisper service.</p>
      )}

      {mode === 'text' && (
        <Textarea
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              submitTextChunk()
            }
          }}
          placeholder={live ? 'Type what the doctor says, then press Ctrl+Enter' : 'Press Start dictation, then type'}
          rows={4}
          className="mb-3"
        />
      )}

      <Button
        variant={live ? 'primary' : 'secondary'}
        className="w-full mb-3"
        disabled={structuring || (!live && mode === 'mic' && !sttSupported)}
        onClick={live ? handleStop : handleStart}
      >
        {structuring ? 'Structuring transcript…' : live ? 'Stop dictation' : 'Start dictation'}
      </Button>
    </div>
  )
}
