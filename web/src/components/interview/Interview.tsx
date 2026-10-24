import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ArrowUp, Check, Split } from 'lucide-react'
import type { ClarifyQuestion } from '@shared/api'
import { clarify } from '@/lib/api'
import { composeDecision } from './compose'

const EASE = [0.2, 0, 0, 1] as const
const enter = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, ease: EASE } }
const STEPS = ['Reading your decision', 'Finding what matters', 'Drafting questions'] as const
const STEP_AT = [0, 2500, 6000]
const FAIL_DELAY = 1500
const DONE_DELAY = 900

type Status = 'loading' | 'asking' | 'done' | 'failed'

/** Short back-and-forth before research: asks the /api/clarify questions one at a time, then starts the run. */
export function Interview({ decision, onStart, onBack, error }: {
  decision: string
  onStart: (text: string) => void
  onBack: () => void
  error: string | null
}) {
  const [status, setStatus] = useState<Status>('loading')
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([])
  // undefined = not reached yet, null = skipped
  const [answers, setAnswers] = useState<(string | null)[]>([])
  const [failNote, setFailNote] = useState('')
  const started = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const index = answers.length

  const start = useCallback((text: string) => {
    if (started.current) return
    started.current = true
    onStart(text)
  }, [onStart])

  // A failed onStart (App shows `error`) lets the user try again.
  useEffect(() => { if (error) started.current = false }, [error])

  useEffect(() => {
    let alive = true
    clarify({ decision })
      .then((res) => {
        if (!alive) return
        const qs = (res.questions ?? []).filter((q) => q.question?.trim())
        if (qs.length === 0) { setFailNote('No questions needed — researching with what you wrote.'); setStatus('failed'); return }
        setQuestions(qs.slice(0, 5))
        setStatus('asking')
      })
      .catch(() => { if (alive) { setFailNote("Couldn't prepare questions — researching with what you wrote."); setStatus('failed') } })
    return () => { alive = false }
  }, [decision])

  useEffect(() => {
    if (status !== 'failed') return
    const t = window.setTimeout(() => start(decision), FAIL_DELAY)
    return () => window.clearTimeout(t)
  }, [status, decision, start])

  const finish = useCallback((all: (string | null)[]) => {
    setStatus('done')
    const answered = questions.flatMap((q, i) => (all[i] ? [{ question: q.question, answer: all[i] as string }] : []))
    window.setTimeout(() => start(composeDecision(decision, answered)), DONE_DELAY)
  }, [questions, decision, start])

  const answer = useCallback((value: string | null) => {
    if (status !== 'asking') return
    const next = [...answers, value]
    setAnswers(next)
    if (next.length >= questions.length) finish(next)
  }, [answers, questions.length, status, finish])

  const skipAll = () => {
    const answered = questions.flatMap((q, i) => (answers[i] ? [{ question: q.question, answer: answers[i] as string }] : []))
    setStatus('done')
    start(composeDecision(decision, answered))
  }

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scroller.current?.closest('.ui-scroll') as HTMLElement | null
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [status, index, error])

  return (
    <div ref={scroller} className="rounded-[8px] border border-crux-border-strong bg-crux-surface p-5 shadow-base">
      <div className="flex items-center gap-2">
        <div className="ui-label"><Split className="!size-3.5" />Decision</div>
        <div className="flex-1" />
        {status === 'asking' ? (
          <span className="ui-num text-[12px] text-crux-text-tertiary" aria-live="polite">Question {Math.min(index + 1, questions.length)} of {questions.length}</span>
        ) : null}
      </div>
      {status === 'asking' || status === 'done' ? <Dots total={questions.length} done={index} /> : null}

      <div className="mt-4 flex flex-col gap-3">
        <UserBubble text={decision} clamp />

        {status === 'loading' ? <Loading /> : null}

        {questions.slice(0, index + (status === 'asking' ? 1 : 0)).map((q, i) => (
          <div key={q.id || i} className="flex flex-col gap-3">
            <AssistantQuestion q={q} />
            {i < index ? (
              answers[i] ? <UserBubble text={answers[i] as string} /> : <SkippedRow />
            ) : (
              <AnswerBox key={`box-${i}`} q={q} onAnswer={answer} />
            )}
          </div>
        ))}

        <AnimatePresence>
          {status === 'done' ? (
            <motion.div key="done" {...enter} className="flex items-center gap-2 text-[13px] text-crux-text-secondary">
              <Check className="!size-4 text-crux-accent" />Got it. Researching with what you told me.
            </motion.div>
          ) : null}
          {status === 'failed' ? (
            <motion.div key="fail" {...enter} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border border-crux-border bg-crux-subtle px-3 py-2.5 text-[13px] text-crux-text-secondary">
              <span>{failNote}</span>
              <button type="button" className="ui-link" onClick={() => start(decision)}>Research now</button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 text-crux-warn">
            <span>{error}</span>
            <button type="button" className="ui-link" onClick={onBack}>Edit decision</button>
          </div>
        ) : null}
      </div>

      {status === 'loading' || status === 'asking' ? (
        <div className="mt-4 flex items-center gap-3 border-t border-crux-border pt-3">
          <button type="button" className="ui-link inline-flex items-center gap-1 !font-normal !text-crux-text-tertiary hover:!text-crux-text" onClick={onBack}>
            Edit decision
          </button>
          <div className="flex-1" />
          <button type="button" className="ui-link inline-flex items-center gap-1" onClick={skipAll}>
            Skip questions — research now<ArrowRight className="!size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function UserBubble({ text, clamp }: { text: string; clamp?: boolean }) {
  return (
    <motion.div {...enter} className="flex justify-end">
      <div className={`max-w-[85%] rounded-[12px] rounded-br-[4px] bg-crux-subtle px-3 py-2 text-[14px] leading-5 whitespace-pre-wrap text-crux-text ${clamp ? 'line-clamp-4' : ''}`}>
        {text}
      </div>
    </motion.div>
  )
}

function SkippedRow() {
  return (
    <motion.div {...enter} className="flex justify-end">
      <span className="text-[12px] text-crux-text-quaternary italic">Skipped</span>
    </motion.div>
  )
}

function AssistantMark() {
  return (
    <span aria-hidden className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full border border-crux-accent-border bg-crux-accent-soft text-crux-accent">
      <Split className="!size-3" />
    </span>
  )
}

function AssistantQuestion({ q }: { q: ClarifyQuestion }) {
  return (
    <motion.div {...enter} className="flex gap-2.5">
      <AssistantMark />
      <div className="min-w-0">
        <p className="text-[14px] leading-5 font-medium text-crux-text">{q.question}</p>
        {q.why ? <p className="mt-0.5 text-[12px] leading-4 text-crux-text-tertiary">{q.why}</p> : null}
      </div>
    </motion.div>
  )
}

function AnswerBox({ q, onAnswer }: { q: ClarifyQuestion; onAnswer: (v: string | null) => void }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { const t = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 220); return () => window.clearTimeout(t) }, [])
  const send = () => { const v = text.trim(); if (v) onAnswer(v) }
  return (
    <motion.div {...enter} transition={{ duration: 0.2, ease: EASE, delay: 0.08 }} className="pl-[34px]">
      {q.suggestions?.length ? (
        <div className="flex flex-wrap gap-2">
          {q.suggestions.slice(0, 4).map((s) => (
            <button key={s} type="button" className="ui-pill !h-7 !px-2.5 !text-[13px] hover:!border-crux-accent-border hover:!bg-crux-accent-soft hover:!text-crux-accent-text"
              onClick={() => onAnswer(s)}>{s}</button>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-crux-border-strong bg-crux-surface py-1 pr-1 pl-3 transition-[border-color,box-shadow] duration-150 focus-within:border-crux-accent focus-within:shadow-[0_0_0_3px_var(--crux-accent-soft)]">
        <input ref={input} value={text} maxLength={600} onChange={(e) => setText(e.target.value)}
          placeholder="Or type your answer…" aria-label={`Answer: ${q.question}`}
          className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-crux-text outline-none placeholder:text-crux-text-quaternary"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
            else if (e.key === 'Escape') { e.preventDefault(); onAnswer(null) }
          }} />
        <button type="button" className="ui-btn ghost sm" onClick={() => onAnswer(null)} title="Skip (Esc)">Skip</button>
        <button type="button" className="ui-btn primary sm icon" disabled={!text.trim()} onClick={send} aria-label="Send answer" title="Send (Enter)">
          <ArrowUp className="!size-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

function Dots({ total, done }: { total: number; done: number }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${i < done ? 'bg-crux-accent' : i === done ? 'bg-crux-accent-border' : 'bg-crux-subtle'}`} />
      ))}
    </div>
  )
}

function Loading() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    const id = window.setInterval(() => setElapsed(performance.now() - t0), 200)
    return () => window.clearInterval(id)
  }, [])
  const step = STEP_AT.reduce((s, at, i) => (elapsed >= at ? i : s), 0)
  // Eases towards 92% over ~10 s; the answer arriving replaces this row.
  const pct = 8 + 84 * (1 - Math.exp(-elapsed / 4000))
  return (
    <motion.div {...enter} className="flex flex-col gap-3" aria-live="polite">
      <div className="flex gap-2.5">
        <AssistantMark />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-5 text-crux-text-secondary">Decision Lab is reading your decision…</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-crux-subtle">
            <div className="h-full rounded-full bg-crux-accent transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex gap-3 text-[11px] leading-4">
            {STEPS.map((s, i) => (
              <span key={s} className={`transition-colors duration-200 ${i < step ? 'text-crux-text-tertiary' : i === step ? 'text-crux-text font-medium' : 'text-crux-text-quaternary'}`}>
                {i < step ? <Check className="mr-0.5 inline !size-3 align-[-2px]" /> : null}{s}
              </span>
            ))}
          </div>
        </div>
      </div>
      <motion.div className="pl-[34px]" animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="ui-skel w-[70%]" />
        <div className="ui-skel mt-2 w-[45%]" />
        <div className="mt-3 flex gap-2"><div className="ui-skel !h-7 w-24 !rounded-full" /><div className="ui-skel !h-7 w-20 !rounded-full" /><div className="ui-skel !h-7 w-28 !rounded-full" /></div>
      </motion.div>
    </motion.div>
  )
}
