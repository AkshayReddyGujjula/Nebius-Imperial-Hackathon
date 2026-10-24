import { useEffect, useRef, useState } from 'react'
import { Loader, Mic, Square } from 'lucide-react'
import { useCrux } from '@/store/runStore'
import { transcribe } from '@/lib/api'
import { createRecorder, recorderSupported, type Recorder } from '@/lib/recorder'
import { fmtClock } from '@/lib/format'

const MAX_MS = 90_000

/** Push-to-talk: click to record, click again (or 90 s) to stop; the transcript is appended to the draft. */
export function MicButton({ onError }: { onError: (msg: string | null) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const rec = useRef<Recorder | null>(null)
  const startedAt = useRef(0)

  const stop = async () => {
    const r = rec.current
    if (!r) return
    rec.current = null
    setState('transcribing')
    try {
      const blob = await r.stop()
      const { text } = await transcribe(blob)
      const existing = useCrux.getState().draft.trim()
      useCrux.getState().setDraft(existing ? `${existing} ${text}` : text, 'voice')
      onError(null)
      window.setTimeout(() => document.getElementById('crux-run')?.focus(), 0)
    } catch (e) {
      onError(e instanceof Error && e.message ? e.message : "Couldn't transcribe — try again or type instead.")
    } finally {
      setState('idle')
    }
  }

  useEffect(() => {
    if (state !== 'recording') return
    const t = window.setInterval(() => {
      const ms = Date.now() - startedAt.current
      setElapsed(ms)
      if (ms >= MAX_MS) void stop()
    }, 250)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => () => rec.current?.cancel(), [])

  const start = async () => {
    onError(null)
    const r = createRecorder()
    try {
      await r.start()
      rec.current = r
      startedAt.current = Date.now()
      setElapsed(0)
      setState('recording')
    } catch {
      r.cancel()
      onError('Microphone blocked — allow it in the address bar, or type instead.')
    }
  }

  if (!recorderSupported()) return null
  if (state === 'recording') {
    return (
      <button type="button" className="ui-btn h-9 gap-2 !px-2.5" onClick={() => void stop()} aria-label="Stop recording" title="Stop recording">
        <span className="size-2 rounded-full bg-crux-bad crux-status-active" />
        <span className="ui-num text-[12px] text-crux-text-secondary">{fmtClock(elapsed)}</span>
        <Square className="!size-3.5" />
      </button>
    )
  }
  return (
    <button type="button" className="ui-btn icon !size-9" disabled={state === 'transcribing'}
      onClick={() => void start()} aria-label={state === 'transcribing' ? 'Transcribing…' : 'Record your decision'}
      title={state === 'transcribing' ? 'Transcribing…' : 'Say it instead'}>
      {state === 'transcribing' ? <Loader className="ui-spin !size-4" /> : <Mic className="!size-4" />}
    </button>
  )
}
