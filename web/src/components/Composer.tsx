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
      <div className="ui-composer">
        <textarea
          ref={ref}
          id="crux-composer"
          autoFocus
          className="ui-textarea ui-scroll"
          rows={3}
          maxLength={4000}
          value={draft}
          placeholder="I have a hackathon tomorrow and my exam is the day after…"
          aria-label="Describe your decision"
          onChange={(e) => setDraft(e.target.value, 'text')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] text-crux-text-tertiary">
            <kbd className="ui-mono">Enter</kbd> to send · <kbd className="ui-mono">Shift</kbd>+<kbd className="ui-mono">Enter</kbd> new line
          </span>
          <div className="flex-1" />
          {draft.length > 3500 ? (
            <span className="ui-num text-[12px] text-crux-text-tertiary">{draft.length.toLocaleString('en-GB')} / 4,000</span>
          ) : null}
          {!ready && draft.trim().length > 0 ? (
            <span className="text-[12px] text-crux-text-tertiary">Write at least 10 characters</span>
          ) : null}
          {mic}
          <button id="crux-run" type="button" className="ui-btn primary icon !size-9" disabled={!ready || busy}
            onClick={submit} aria-label="Send" title={ready ? 'Send' : 'Write at least 10 characters'}>
            <ArrowUp className="!size-4" />
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[12px] leading-4 text-crux-warn">{error}</p> : null}
    </div>
  )
}
