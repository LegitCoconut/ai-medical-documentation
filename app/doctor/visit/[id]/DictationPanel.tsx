'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import type { DiagnosisItem, PrescriptionItem, Vitals } from '@/lib/types'

type Mode = 'whisper' | 'browser' | 'text'

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
  onerror: ((e: { error: string }) => void) | null
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

// ─── Whisper helpers ──────────────────────────────────────────────────────────

const WHISPER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function getSupportedMime(): string | null {
  for (const mime of WHISPER_MIME_TYPES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return mime
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DictationPanel({
  visitId,
  initialTranscript,
  onStructured,
}: {
  visitId: string
  initialTranscript: { id: string; text: string; at: string | Date }[]
  onStructured: (result: StructureResult) => void
}) {
  const [mode, setMode] = useState<Mode>('whisper')
  const [browserSttSupported, setBrowserSttSupported] = useState(false)
  const [whisperSupported, setWhisperSupported] = useState(false)
  const [live, setLive] = useState(false)
  const [structuring, setStructuring] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [textDraft, setTextDraft] = useState('')
  const [transcriptText, setTranscriptText] = useState(() =>
    (initialTranscript ?? []).map((c) => c.text).join('\n')
  )
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<{ text: string; source: StructureResult['source'] } | null>(null)
  // Whisper recording state
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    setBrowserSttSupported(!!SR)
    setWhisperSupported(!!getSupportedMime() && !!navigator.mediaDevices?.getUserMedia)
    // Default to whisper if supported, else browser, else text
    if (!getSupportedMime() || !navigator.mediaDevices?.getUserMedia) {
      if (SR) setMode('browser')
      else setMode('text')
    }
  }, [])

  // no auto-scroll needed now; transcript is an editable text area

  // Cleanup on unmount
  useEffect(() => () => {
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  function addToTranscript(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setTranscriptText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${trimmed}` : trimmed))
  }

  function showSummary(data: StructureResult) {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current)
    setSummary({ text: summaryLine(data.added), source: data.source })
    summaryTimerRef.current = setTimeout(() => setSummary(null), 5000)
  }

  // ─── Whisper: send a recorded audio blob to /api/transcribe ───────────────
  async function transcribeBlob(blob: Blob): Promise<string> {
    const form = new FormData()
    form.append('audio', blob, 'audio.webm')
    const res = await fetch('/api/transcribe', { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || `Transcription failed (${res.status})`)
    }
    const data = await res.json()
    return typeof data.text === 'string' ? data.text : ''
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  async function handleStart() {
    if (structuring || live) return
    setError('')

    if (mode === 'whisper') {
      const mime = getSupportedMime()
      if (!mime) { setError('Your browser does not support audio recording.'); return }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setError('Microphone access denied. Please allow microphone access and try again.')
        return
      }
      streamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mime })
        audioChunksRef.current = []
        if (blob.size < 1000) return // too short, skip
        setTranscribing(true)
        try {
          const text = await transcribeBlob(blob)
          if (text) addToTranscript(text)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed.')
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      // Recording timer
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    }

    if (mode === 'browser') {
      if (!browserSttSupported) return
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
          if (res.isFinal) addToTranscript(res[0].transcript)
          else interim += res[0].transcript
        }
        setInterimText(interim)
      }
      rec.onerror = (e) => {
        if (e.error !== 'no-speech') setError(`Speech recognition error: ${e.error}`)
      }
      rec.onend = () => {
        recognitionRef.current = null
      }
      rec.start()
      recognitionRef.current = rec
    }

    setLive(true)
  }

  // ─── Stop (does NOT generate; leaves transcript editable) ────────────────
  function handleStop() {
    if (structuring) return

    if (mode === 'whisper') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setRecordingSeconds(0)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    } else if (mode === 'browser') {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setInterimText('')
    } else {
      const trimmed = textDraft.trim()
      if (trimmed) {
        addToTranscript(trimmed)
        setTextDraft('')
      }
    }

    setLive(false)
  }

  async function runStructure() {
    const transcript = transcriptText.trim()
    if (!transcript) {
      setError('Add some transcript text first.')
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
      showSummary(data)
    } catch {
      setError('Generation failed — check your transcript and try again. Your transcript is safe.')
    } finally {
      setStructuring(false)
    }
  }

  function submitTextChunk() {
    if (!live) return
    if (!textDraft.trim()) return
    addToTranscript(textDraft)
    setTextDraft('')
  }

  function formatSeconds(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const isBusy = structuring || transcribing
  const canUseMic = mode !== 'text'

  return (
    <div className="flex flex-col h-full">
      <h3 className="label-xs mb-2">Live transcript</h3>
      <Textarea
        value={transcriptText}
        onChange={(e) => setTranscriptText(e.target.value)}
        rows={8}
        placeholder="Live transcript appears here. You can edit or paste text. Click “Generate prescription” when ready."
        className="flex-1 min-h-0 mb-2 font-mono text-[12px]"
      />
      {interimText && <div className="italic text-[11px] text-[var(--muted)] mb-2">{interimText}</div>}

      {/* Status bar */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] mb-3 min-h-4">
        {live && mode === 'whisper' && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Recording {formatSeconds(recordingSeconds)}</span>
          </>
        )}
        {transcribing && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse" />
            <span>Transcribing audio…</span>
          </>
        )}
        {structuring && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse" />
            <span>Structuring transcript…</span>
          </>
        )}
        {!isBusy && !live && summary && (
          <>
            <span>{summary.text}</span>
            <span className="text-[var(--muted)]">via {summary.source === 'llm' ? 'model' : 'rules'}</span>
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-[var(--muted)] mb-2">{error}</p>}

      <Button
        id="generate-prescription-btn"
        variant="primary"
        className="w-full mb-3"
        disabled={isBusy || live || !transcriptText.trim()}
        onClick={runStructure}
      >
        {structuring ? 'Generating prescription…' : 'Create prescription'}
      </Button>

      {/* Mode selector */}
      <div className="flex border border-[var(--border-strong)] rounded overflow-hidden mb-3 text-sm">
        <button
          id="mode-whisper"
          onClick={() => setMode('whisper')}
          disabled={!whisperSupported}
          title="Whisper AI (local speech-to-text)"
          className={`flex-1 py-1.5 ${mode === 'whisper' ? 'bg-[var(--dark)] text-white' : 'bg-[var(--surface)]'} disabled:opacity-40`}
        >
          🎙 Whisper
        </button>
        <button
          id="mode-browser"
          onClick={() => setMode('browser')}
          disabled={!browserSttSupported}
          title="Browser built-in speech recognition"
          className={`flex-1 py-1.5 border-l border-[var(--border-strong)] ${mode === 'browser' ? 'bg-[var(--dark)] text-white' : 'bg-[var(--surface)]'} disabled:opacity-40`}
        >
          🌐 Browser
        </button>
        <button
          id="mode-text"
          onClick={() => setMode('text')}
          className={`flex-1 py-1.5 border-l border-[var(--border-strong)] ${mode === 'text' ? 'bg-[var(--dark)] text-white' : 'bg-[var(--surface)]'}`}
        >
          ⌨ Text
        </button>
      </div>

      {/* Mode hints */}
      {mode === 'whisper' && (
        <p className="text-[11px] text-[var(--muted)] mb-3">
          Records your microphone then sends audio to the local Whisper service for transcription.
          {!whisperSupported && ' ⚠ Audio recording not supported in this browser.'}
        </p>
      )}
      {mode === 'browser' && (
        <p className="text-[11px] text-[var(--muted)] mb-3">
          Uses the browser&apos;s built-in speech recognition (requires internet in most browsers).
        </p>
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
        id="dictation-toggle-btn"
        variant={live ? 'primary' : 'secondary'}
        className="w-full mb-3"
        disabled={isBusy || (!live && canUseMic && mode === 'whisper' && !whisperSupported) || (!live && mode === 'browser' && !browserSttSupported)}
        onClick={live ? handleStop : handleStart}
      >
        {structuring
          ? 'Structuring transcript…'
          : transcribing
          ? 'Transcribing audio…'
          : live
          ? mode === 'whisper'
            ? `Stop recording (${formatSeconds(recordingSeconds)})`
            : 'Stop dictation'
          : 'Start dictation'}
      </Button>
    </div>
  )
}
