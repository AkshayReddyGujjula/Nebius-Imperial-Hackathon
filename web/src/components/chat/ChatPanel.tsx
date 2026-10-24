import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, ChevronDown, FileText } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { sendChat } from '@/lib/api'
import { MicButton } from '@/components/MicButton'
import { ActivityRail } from '@/components/rail/ActivityRail'
import { countFacts, isChanged, parseMemory } from './memory'
import './chat.css'

const EASE = [0.2, 0, 0, 1] as const
const TYPING_TIMEOUT_MS = 30_000
const INPUT_ID = 'dl-chat-input'

/** Left column of the live layout: Conversation | Research tabs. */
export function ChatPanel() {
  const [tab, setTab] = useState<'chat' | 'research'>('chat')
  return (
    <aside className="dl-chat h-full w-[420px]" aria-label="Conversation">
      <div className="dl-tabs" role="tablist">
        <button type="button" role="tab" className="dl-tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>Conversation</button>
        <button type="button" role="tab" className="dl-tab" aria-selected={tab === 'research'} onClick={() => setTab('research')}>Research</button>
      </div>
      {tab === 'chat' ? <Conversation /> : <div className="flex min-h-0 flex-1 flex-col"><ActivityRail /></div>}
    </aside>
  )
}

function Conversation() {
  const chat = useCrux((s) => s.chat)
  const live = useCrux((s) => !s.mock && !s.replay)
  // Sends awaiting their echo (optimistic bubble) and the assistant reply (typing row).
  const [pending, setPending] = useState<{ text: string; users: number; assistants: number; at: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const mountedAt = useRef(Date.now())
  const users = chat.filter((m) => m.role === 'user').length
  const assistants = chat.length - users
  // The first message is sent by startRun; until the first reply lands, show the typing row too.
  const firstWait = live && assistants === 0
  const echoed = pending !== null && users > pending.users
  const waiting = (firstWait || (pending !== null && assistants <= pending.assistants)) && now - (pending?.at ?? mountedAt.current) < TYPING_TIMEOUT_MS

  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [waiting])

  const latest = chat[chat.length - 1]
  const answered = latest?.role !== 'assistant' || (pending !== null && pending.assistants >= assistants)

  const threadRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat.length, waiting, pending?.text])

  const onSent = (text: string) => setPending({ text, users, assistants, at: Date.now() })

  return (
    <>
      <MemoryCard />
      <div ref={threadRef} className="dl-thread ui-scroll">
        <AnimatePresence initial={false}>
          {chat.map((m, i) => (
            <motion.div key={m.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}
              className={m.role === 'user' ? 'flex flex-col' : ''}>
              {m.role === 'user' ? <div className="dl-user">{m.text}</div> : (
                <div>
                  <div className="dl-asst-label">Decision Lab · DeepSeek V4.1 Flash</div>
                  <div className="dl-asst">{m.text}</div>
                  {i === chat.length - 1 && !answered && m.suggestions.length > 0 ? (
                    <Options suggestions={m.suggestions} recommended={m.recommendedIndex} disabled={!live} onSent={onSent} />
                  ) : null}
                </div>
              )}
            </motion.div>
          ))}
          {pending && !echoed ? (
            <motion.div key="pending" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="flex flex-col">
              <div className="dl-user pending">{pending.text}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <ResearchStatus />
        {waiting ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} aria-label="Decision Lab is thinking">
            <div className="dl-asst-label">Decision Lab</div>
            <span className="dl-dots"><i /><i /><i /></span>
          </motion.div>
        ) : null}
      </div>
      <ChatInput disabled={!live} onSent={onSent} />
    </>
  )
}

function MemoryCard() {
  const { memory, changes, seq } = useCrux(useShallow((s) => ({ memory: s.memory, changes: s.memoryChanges, seq: s.memorySeq })))
  const lines = useMemo(() => parseMemory(memory), [memory])
  const [open, setOpen] = useState(true)
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    if (!seq) return
    setFresh(true)
    const t = window.setTimeout(() => setFresh(false), 3000)
    return () => window.clearTimeout(t)
  }, [seq])

  const n = countFacts(lines)
  return (
    <section className="dl-mem">
      <button type="button" className="dl-mem-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="dl-mem-title">What I know about you</span>
            <span className="dl-tag">user.md</span>
            {fresh ? <span className="dl-updated">Updated</span> : null}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[color:var(--c-muted)]">
            {open ? 'Shared with every agent' : n === 0 ? 'Nothing yet' : `${n} thing${n === 1 ? '' : 's'} I know about you`}
          </div>
        </div>
        <ChevronDown className={`size-4 flex-none text-[color:var(--c-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="dl-mem-body ui-scroll">
              {lines.length === 0 ? <p className="text-[13px] text-[color:var(--c-muted)]">As we talk, I'll note what matters to you here.</p> : null}
              {lines.map((l, i) => l.kind === 'heading'
                ? <div key={i} className="dl-mem-h">{l.text}</div>
                : <div key={i} className={`dl-mem-li ${l.kind === 'bullet' ? 'b' : ''} ${fresh && isChanged(l.text, changes) ? 'hl' : ''}`}>{l.text}</div>)}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

const KEYS = 'ABCDEFGH'

function Options({ suggestions, recommended, disabled, onSent }: {
  suggestions: string[]; recommended: number | null; disabled: boolean; onSent: (text: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = async (text: string) => {
    if (busy || disabled) return
    setBusy(true); setError(null)
    try { await send(text, 'text'); onSent(text) } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="dl-opts">
      {suggestions.map((s, i) => (
        <button key={i} type="button" className={`dl-opt ${i === recommended ? 'rec' : ''}`} disabled={busy || disabled} onClick={() => void pick(s)}>
          <span className="dl-key">{KEYS[i] ?? i + 1}</span>
          <span className="min-w-0 flex-1">{s}</span>
          {i === recommended ? <span className="dl-likely">Likely</span> : null}
        </button>
      ))}
      <button type="button" className="dl-opt own" disabled={disabled} onClick={() => document.getElementById(INPUT_ID)?.focus()}>
        <span className="dl-key">…</span><span>Type my own answer…</span>
      </button>
      {error ? <p className="dl-err">{error}</p> : null}
    </div>
  )
}

function ResearchStatus() {
  const { agents, phase, briefReady, synthSeq } = useCrux(useShallow((s) => ({
    agents: Object.values(s.agents), phase: s.phase, briefReady: s.synthesisStatus === 'ready', synthSeq: s.synthesisSeq,
  })))
  const select = useCrux((s) => s.select)
  const active = phase === 'planning' || phase === 'researching' || phase === 'checking' || phase === 'synthesizing'
  const done = agents.filter((a) => a.status === 'done' || a.status === 'failed' || a.status === 'timeout').length
  const n = agents.length

  return (
    <>
      {active ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="dl-status">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {n === 0 ? 'Planning the research…' : phase === 'synthesizing' ? 'Writing the decision brief…' : phase === 'checking' ? 'Checking the evidence…' : `Researching ${n} question${n === 1 ? '' : 's'}`}
            </span>
            {n > 0 ? <span className="ui-num text-[12px] text-[color:var(--c-muted)]">{done} done</span> : null}
          </div>
          <div className="dl-bar"><span style={{ width: `${n ? Math.max(4, (done / n) * 100) : 4}%` }} /></div>
          {n > 0 ? (
            <div className="flex flex-wrap gap-1">
              {agents.map((a, i) => {
                const fin = a.status === 'done' || a.status === 'failed' || a.status === 'timeout'
                return <span key={a.id} className={`dl-badge ${fin ? 'done' : a.status !== 'queued' ? 'live' : ''}`} title={`${a.id} · ${a.status}`}>{i + 1}</span>
              })}
            </div>
          ) : null}
        </motion.div>
      ) : null}
      {briefReady ? (
        <motion.button key={synthSeq} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}
          className="dl-chip" onClick={() => select(nodeId.recommendation)}>
          <FileText className="size-3.5" />Decision brief updated
        </motion.button>
      ) : null}
    </>
  )
}

const LINE = 20

function ChatInput({ disabled, onSent }: { disabled: boolean; onSent: (text: string) => void }) {
  const draft = useCrux((s) => s.draft)
  const mode = useCrux((s) => s.draftInputMode)
  const setDraft = useCrux((s) => s.setDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(7 * LINE, Math.max(LINE, el.scrollHeight - 10))}px`
  }, [draft])

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy || disabled) return
    setBusy(true); setError(null)
    const started = Date.now()
    try {
      await send(text, mode)
      setDraft('', 'text')
      onSent(text)
    } catch (e) { setError(errText(e)) }
    finally { window.setTimeout(() => setBusy(false), Math.max(0, 1000 - (Date.now() - started))) }
  }

  return (
    <div className="dl-input">
      <div className="dl-input-box">
        <textarea ref={ref} id={INPUT_ID} rows={1} maxLength={4000} value={disabled ? '' : draft} disabled={disabled || busy}
          placeholder="Reply, or add anything about your situation…" aria-label="Reply to Decision Lab"
          onChange={(e) => setDraft(e.target.value, 'text')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
        {disabled ? null : <MicButton onError={setError} />}
        <button type="button" className="ui-btn primary icon !size-8 !rounded-[8px]" disabled={disabled || busy || !draft.trim()} onClick={() => void submit()} aria-label="Send">
          <ArrowUp className="!size-4" />
        </button>
      </div>
      {disabled ? <p className="dl-note">Replay — start a live conversation to chat</p> : null}
      {error ? <p className="dl-err">{error}</p> : null}
    </div>
  )
}

async function send(text: string, mode: 'text' | 'voice'): Promise<void> {
  const runId = useCrux.getState().runId
  if (!runId) throw new Error('No live conversation')
  await sendChat(runId, text, mode)
}

const errText = (e: unknown) => `Couldn't send — ${e instanceof Error ? e.message : 'server unreachable'}.`
