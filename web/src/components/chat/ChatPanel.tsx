import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Search } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { MicButton } from '@/components/MicButton'
import { ActivityRail } from '@/components/rail/ActivityRail'
import { countFacts, isChanged, parseMemory } from './memory'
import { conditional, errText, openQuestions, send, sentences, useChatUi } from './chatUi'
import './chat.css'

const EASE = [0.2, 0, 0, 1] as const
const TYPING_TIMEOUT_MS = 30_000
const INPUT_ID = 'dl-chat-input'
const BULLETS = 2

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
  const { pending, skipped, setDeckOpen } = useChatUi(useShallow((s) => ({ pending: s.pending, skipped: s.skipped, setDeckOpen: s.setDeckOpen })))
  const [now, setNow] = useState(Date.now())
  const mountedAt = useRef(Date.now())
  const users = chat.filter((m) => m.role === 'user').length
  const assistants = chat.length - users
  // The first message is sent by startRun; until the first reply lands, show the typing row too.
  const firstWait = live && assistants === 0
  const echoed = pending !== null && users > pending.users
  const waiting = (firstWait || (pending !== null && assistants <= pending.assistants)) && now - (pending?.at ?? mountedAt.current) < TYPING_TIMEOUT_MS
  const asked = useMemo(() => new Set(openQuestions(chat, pending, skipped).map((m) => m.id)), [chat, pending, skipped])
  const lastAsst = [...chat].reverse().find((m) => m.role === 'assistant')?.id

  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [waiting])

  const threadRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat.length, waiting, pending?.text])

  return (
    <>
      <StatusStrip waiting={waiting} yourTurn={asked.size > 0} />
      <MemoryRow />
      <div ref={threadRef} className="dl-thread ui-scroll">
        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <motion.div key={m.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}
              className={m.role === 'user' ? 'flex flex-col' : ''}>
              {m.role === 'user'
                ? <><div className="dl-user">{m.text}</div><Receipt id={m.id} /></>
                : <Reply text={m.text} latest={m.id === lastAsst} asked={asked.has(m.id)} onAsk={() => setDeckOpen(true)} />}
            </motion.div>
          ))}
          {pending && !echoed ? (
            <motion.div key="pending" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="flex flex-col">
              <div className="dl-user pending">{pending.text}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {waiting ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} aria-label="Decision Lab is thinking">
            <span className="dl-dots"><i /><i /><i /></span>
          </motion.div>
        ) : null}
      </div>
      <ChatInput disabled={!live} />
    </>
  )
}

/** One assistant reply as chunks: bold lead line, up to 2 bullets, "If X → Y" chips; the rest behind "More".
 *  Older replies collapse to their lead line. */
function Reply({ text, latest, asked, onAsk }: { text: string; latest: boolean; asked: boolean; onAsk: () => void }) {
  const [more, setMore] = useState(false)
  const all = useMemo(() => sentences(text), [text])
  // The question itself lives in the centred deck while it is open.
  const qAt = all.map((s) => s.endsWith('?')).lastIndexOf(true)
  const body = asked && qAt >= 0 && all.length > 1 ? all.filter((_, i) => i !== qAt) : all
  const [lead, ...rest] = body
  const chips = rest.map(conditional).filter((c): c is { when: string; then: string } => c !== null)
  const bullets = rest.filter((s) => !conditional(s))
  const open = latest || more
  const shown = more ? bullets : open ? bullets.slice(0, BULLETS) : []
  const hasMore = bullets.length > shown.length || (!open && chips.length > 0)

  return (
    <div className={`dl-reply ${latest ? '' : 'old'}`}>
      {lead ? <p className="dl-lead">{lead}</p> : null}
      {shown.length ? <ul className="dl-bullets">{shown.map((s, i) => <li key={i}>{s}</li>)}</ul> : null}
      {open && chips.length ? (
        <div className="dl-cond">{chips.map((c, i) => <span key={i} className="dl-cond-chip"><span className="w">{c.when}</span><span className="t">→ {c.then}</span></span>)}</div>
      ) : null}
      {hasMore || more || asked ? (
        <div className="dl-reply-foot">
          {hasMore || more ? <button type="button" className="dl-more" onClick={() => setMore(!more)}>{more ? 'Less' : 'More'}</button> : null}
          {asked ? <button type="button" className="dl-ask" onClick={onAsk}><ArrowDown className="size-3.5" />Question for you</button> : null}
        </div>
      ) : null}
    </div>
  )
}

/** One line: what is happening, and where to look. */
function StatusStrip({ waiting, yourTurn }: { waiting: boolean; yourTurn: boolean }) {
  const { agentMap, phase, briefReady } = useCrux(useShallow((s) => ({ agentMap: s.agents, phase: s.phase, briefReady: s.synthesisStatus === 'ready' })))
  const select = useCrux((s) => s.select)
  const agents = Object.values(agentMap)
  const n = agents.length
  const done = agents.filter((a) => a.status === 'done' || a.status === 'failed' || a.status === 'timeout').length

  let tone: 'live' | 'you' | 'done' | 'warn' = 'live'
  let label: string
  if (yourTurn) { tone = 'you'; label = 'Your turn — answer the question' }
  else if (phase === 'error') { tone = 'warn'; label = 'Something went wrong' }
  else if (phase === 'done' || (briefReady && phase !== 'synthesizing')) { tone = 'done'; label = 'Brief ready — see the canvas' }
  else if (phase === 'synthesizing') label = 'Writing the brief'
  else if (phase === 'checking') label = 'Checking the evidence'
  else if (phase === 'researching' && n) label = `Researching — ${done} of ${n} done`
  else if (phase === 'planning') label = 'Planning the research'
  else label = waiting ? 'Thinking' : 'Listening'
  const pct = n ? Math.max(6, (done / n) * 100) : 6

  return (
    <button type="button" className={`dl-strip ${tone}`} disabled={tone !== 'done'} onClick={() => select(nodeId.recommendation)} aria-live="polite">
      <span className="dl-strip-dot">{tone === 'done' ? <Check className="size-3" strokeWidth={3} /> : null}</span>
      <span className="dl-strip-label">{label}</span>
      {tone === 'live' && n ? <span className="dl-strip-bar"><span style={{ width: `${pct}%` }} /></span> : null}
    </button>
  )
}

/** user.md as a single-line row; flashes the latest change; expands on click (open by default in Detailed). */
function MemoryRow() {
  const { memory, changes, seq, detailed } = useCrux(useShallow((s) => ({ memory: s.memory, changes: s.memoryChanges, seq: s.memorySeq, detailed: s.viewMode === 'detailed' })))
  const lines = useMemo(() => parseMemory(memory), [memory])
  const [open, setOpen] = useState(detailed)
  const [fresh, setFresh] = useState(false)

  useEffect(() => { setOpen(detailed) }, [detailed])
  useEffect(() => {
    if (!seq) return
    setFresh(true)
    const t = window.setTimeout(() => setFresh(false), 3000)
    return () => window.clearTimeout(t)
  }, [seq])

  const n = countFacts(lines)
  const latest = changes[changes.length - 1]
  return (
    <section className={`dl-mem ${fresh ? 'fresh' : ''}`}>
      <button type="button" className="dl-mem-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dl-tag">user.md</span>
        <span className="dl-mem-line">{fresh && latest ? <><span className="dl-updated">+</span> {latest}</> : n === 0 ? 'Nothing yet' : `${n} thing${n === 1 ? '' : 's'} I know about you`}</span>
        <ChevronDown className={`size-4 flex-none text-[color:var(--c-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="dl-mem-body ui-scroll">
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

/** Under a user bubble: proof the message reached the agents (user.md) and any research it started. */
function Receipt({ id }: { id: string }) {
  const r = useCrux((s) => s.receipts[id])
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  if (!r || (!r.memory.length && !r.research.length)) return null
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="dl-receipt">
      {r.memory.length ? (
        <div title={r.memory.join('\n')}><Check className="size-3" />{detailed ? <>Saved to <span className="dl-tag">user.md</span> → shared with Planner, Agents 1–4, Writer</> : 'Saved'}</div>
      ) : null}
      {r.research.map((q, i) => <div key={i} title={q}><Search className="size-3" />{detailed ? `Started new research: ${q}` : 'New research'}</div>)}
    </motion.div>
  )
}

const LINE = 22
const CHIPS = ['I prefer…', 'Must have…', 'Budget is…']

function ChatInput({ disabled }: { disabled: boolean }) {
  const draft = useCrux((s) => s.draft)
  const mode = useCrux((s) => s.draftInputMode)
  const setDraft = useCrux((s) => s.setDraft)
  const markSent = useChatUi((s) => s.markSent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(7 * LINE + 10, Math.max(LINE + 10, el.scrollHeight))}px`
  }, [draft])

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy || disabled) return
    setBusy(true); setError(null)
    const started = Date.now()
    try {
      await send(text, mode)
      setDraft('', 'text')
      markSent(text)
    } catch (e) { setError(errText(e)) }
    finally { window.setTimeout(() => setBusy(false), Math.max(0, 1000 - (Date.now() - started))) }
  }

  const prefill = (p: string) => {
    setDraft(p, 'text')
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(p.length, p.length) } })
  }

  return (
    <div className="dl-input">
      {disabled ? null : (
        <div className="dl-interject">
          <span className="dl-interject-label">Tell us more anytime</span>
          {CHIPS.map((c) => <button key={c} type="button" className="dl-qchip" disabled={busy} onClick={() => prefill(`${c.replace('…', '')} `)}>{c}</button>)}
        </div>
      )}
      <div className="dl-input-box">
        <textarea ref={ref} id={INPUT_ID} rows={1} maxLength={4000} value={disabled ? '' : draft} disabled={disabled || busy}
          placeholder={disabled ? 'Replay — chat is off' : 'Add anything…'} aria-label="Reply or add information for the agents"
          onChange={(e) => setDraft(e.target.value, 'text')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
        {disabled ? null : <MicButton onError={setError} />}
        <button type="button" className="ui-btn primary icon !size-9 !rounded-[10px]" disabled={disabled || busy || !draft.trim()} onClick={() => void submit()} aria-label="Send">
          <ArrowUp className="!size-4" />
        </button>
      </div>
      {error ? <p className="dl-err">{error}</p> : null}
    </div>
  )
}
