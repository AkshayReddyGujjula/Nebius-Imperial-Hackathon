import { useState } from 'react'
import { Cpu, RotateCcw, Split } from 'lucide-react'
import type { ReplayInfo } from '@shared/api'
import { useCrux } from '@/store/runStore'
import { listReplays } from '@/lib/api'
import { Composer } from './Composer'
import { MicButton } from './MicButton'

export const EXAMPLES = [
  {
    label: 'Hackathon tomorrow, exam the day after — should I go?',
    text: "I've got a hackathon tomorrow from 10 till 7, and my machine learning exam is the day after. The exam is worth 40% of the module and I'm maybe 70% prepared. The hackathon would be great for my CV and I'd learn a lot, but I really don't want to tank the exam. Should I go?",
  },
  {
    label: 'Open models on Nebius or closed APIs for our startup?',
    text: "We're a five-person startup building an AI customer-support agent. Should we run open models on Nebius Token Factory or use closed APIs like OpenAI? We care about cost at scale, answer quality, data privacy for our EU customers, and not getting locked in.",
  },
]

export function EmptyState({ onRun, onReplay, error }: {
  onRun: (text: string) => void
  onReplay: (file: string) => void
  error: string | null
}) {
  const [micError, setMicError] = useState<string | null>(null)
  const setDraft = useCrux((s) => s.setDraft)
  const [replays, setReplays] = useState<ReplayInfo[] | null>(null)
  const [replayError, setReplayError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const toggleReplays = async () => {
    if (open) { setOpen(false); return }
    setOpen(true); setReplayError(null)
    try { setReplays(await listReplays()) }
    catch (e) { setReplays([]); setReplayError(e instanceof Error ? e.message : 'Could not load replays') }
  }

  return (
    <div className="ui-canvas-bg ui-scroll relative h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-[640px] max-w-[calc(100%-48px)] flex-col pt-[9vh] pb-20">
        <div className="rounded-[8px] border border-crux-border-strong bg-crux-surface p-5 shadow-base">
          <div className="ui-label"><Split className="!size-3.5" />Decision</div>
          <h1 className="mt-3 text-[24px] leading-8 font-semibold tracking-[-0.015em]">What are you deciding?</h1>
          <p className="mt-1 mb-4 text-[14px] leading-5 text-crux-text-secondary">
            Type it or say it. Include what matters: deadlines, stakes, what you value.
          </p>
          <Composer onSubmit={onRun} error={error ?? micError} mic={<MicButton onError={setMicError} />} />
          <div className="mt-3 flex items-start gap-2">
            <span className="flex-none text-[12px] leading-[22px] text-crux-text-tertiary">Try:</span>
            <div className="flex min-w-0 flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex.label} type="button" className="ui-pill" onClick={() => {
                  setDraft(ex.text, 'text')
                  // Caret at the end, after React has written the value, so Enter runs it straight away.
                  requestAnimationFrame(() => {
                    const el = document.getElementById('crux-composer') as HTMLTextAreaElement | null
                    if (!el) return
                    el.focus()
                    el.setSelectionRange(el.value.length, el.value.length)
                    el.scrollTop = el.scrollHeight
                  })
                }}>{ex.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 px-1">
          <button type="button" className="ui-link inline-flex items-center gap-1.5 !font-normal !text-crux-text-tertiary hover:!text-crux-text" onClick={toggleReplays}>
            <RotateCcw className="!size-3.5" />Replay a recorded run
          </button>
        </div>
        {open ? (
          <div className="mt-2 overflow-hidden rounded-[8px] border border-crux-border bg-crux-surface shadow-sm">
            {replays === null ? <p className="px-3 py-2.5 text-[13px] text-crux-text-tertiary">Loading…</p> : null}
            {replays && replays.length === 0 ? (
              <p className="px-3 py-2.5 text-[13px] text-crux-text-tertiary">{replayError ? `Couldn't load recorded runs: ${replayError}` : 'No recorded runs yet.'}</p>
            ) : null}
            {replays?.map((r) => (
              <button key={r.file} type="button" onClick={() => onReplay(r.file)}
                className="flex w-full items-center gap-3 border-t border-crux-border px-3 py-2.5 text-left first:border-t-0 hover:bg-crux-hover">
                <span className="min-w-0 flex-1 truncate text-[13px]">{r.decision}</span>
                <span className="ui-mono flex-none text-[11px] text-crux-text-quaternary">{r.recordedAt.slice(0, 16).replace('T', ' ')}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Ghost tree: previews what Crux will build. */}
        <div aria-hidden className="pointer-events-none mt-10 opacity-30 select-none">
          <div className="mx-auto h-6 w-px bg-crux-edge" />
          <div className="mx-[12.5%] h-px bg-crux-edge" />
          <div className="grid grid-cols-4 gap-3">
            {['Question', 'Question', 'Question', 'Blind spot'].map((k, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="h-4 w-px bg-crux-edge" />
                <div className={`ui-ghost w-full ${i === 3 ? '!border-crux-text-quaternary' : ''}`}>
                  <div className="ui-label">{k}</div>
                  <div className="ui-skel mt-2 w-[80%]" />
                  <div className="ui-skel mt-1.5 w-[55%]" />
                </div>
              </div>
            ))}
          </div>
          <div className="ui-ghost mt-6"><div className="ui-label">Recommendation</div><div className="ui-skel mt-2 w-[40%]" /></div>
        </div>

        <div className="mt-auto flex justify-center pt-10">
          <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-crux-text-tertiary [&_svg]:size-3.5"><Cpu />Open models on Nebius Token Factory</span>
        </div>
      </div>
    </div>
  )
}
