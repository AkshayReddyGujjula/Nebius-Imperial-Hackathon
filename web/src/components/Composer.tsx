import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { useCrux } from '@/store/runStore'

const LINE = 22

/** Textarea (3–8 rows) + Run. Enter submits, Shift+Enter adds a newline. */
export function Composer({ onSubmit, mic, error }: { onSubmit: (text: string) => void; mic?: ReactNode; error?: string | null }) {
  const draft = useCrux((s) => s.draft)
  const setDraft = useCrux((s) => s.setDraft)
  const ref = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const ready = draft.trim().length >= 10

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(8 * LINE, Math.max(3 * LINE, el.scrollHeight))}px`
  }, [draft])

  const submit = () => {
    if (!ready || busy) return
    setBusy(true)
    try { onSubmit(draft.trim()) } finally { window.setTimeout(() => setBusy(false), 600) }
  }

  return (
    <div>
      <div className="cx-composer">
        <textarea
          ref={ref}
          id="crux-composer"
          className="cx-textarea cx-scroll"
          rows={3}
          value={draft}
          placeholder="I have a hackathon tomorrow and my exam is the day after…"
          aria-label="Describe your decision"
          onChange={(e) => setDraft(e.target.value, 'text')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] text-crux-text-quaternary">
            <kbd className="cx-mono">Enter</kbd> to run · <kbd className="cx-mono">Shift</kbd>+<kbd className="cx-mono">Enter</kbd> new line
          </span>
          <div className="flex-1" />
          {mic}
          <button id="crux-run" type="button" className="cx-btn primary icon !size-9" disabled={!ready || busy}
            onClick={submit} aria-label="Run" title={ready ? 'Run' : 'Write at least 10 characters'}>
            <ArrowUp className="!size-4" />
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[12px] leading-4 text-crux-warn">{error}</p> : null}
    </div>
  )
}
