import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MessageCircleQuestion, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { MicButton } from '@/components/MicButton'
import { errText, openQuestions, questionOf, send, useChatUi } from './chatUi'
import './chat.css'

const EASE = [0.2, 0, 0, 1] as const
const KEYS = 'ABCDEFGH'

/** Centred, stacked question card over the canvas: one question at a time, the rest as card edges behind it. */
export function QuestionDeck() {
  const chat = useCrux((s) => s.chat)
  const live = useCrux((s) => !s.mock && !s.replay)
  const { pending, skipped, open, setOpen } = useChatUi(useShallow((s) => ({ pending: s.pending, skipped: s.skipped, open: s.deckOpen, setOpen: s.setDeckOpen })))
  const reduce = useReducedMotion()
  const queue = openQuestions(chat, pending, skipped)
  const current = queue[0]
  if (!current) return null
  const more = queue.length - 1

  return (
    <div className="dl-deck-anchor">
      <AnimatePresence mode="wait" initial={!reduce}>
        {open ? (
          <motion.div key={current.id} className="dl-deck"
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.24, ease: EASE }}>
            {more > 0 ? <><div className="dl-deck-edge e1" aria-hidden />{more > 1 ? <div className="dl-deck-edge e2" aria-hidden /> : null}</> : null}
            <QuestionCard key={current.id} id={current.id} text={current.text} suggestions={current.suggestions} recommended={current.recommendedIndex}
              more={more} disabled={!live} onCollapse={() => setOpen(false)} />
          </motion.div>
        ) : (
          <motion.button key="pill" type="button" className="dl-deck-pill" onClick={() => setOpen(true)}
            initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
            <MessageCircleQuestion className="size-4" />Question for you ({queue.length})
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function QuestionCard({ id, text, suggestions, recommended, more, disabled, onCollapse }: {
  id: string; text: string; suggestions: string[]; recommended: number | null; more: number; disabled: boolean; onCollapse: () => void
}) {
  const markSent = useChatUi((s) => s.markSent)
  const skip = useChatUi((s) => s.skip)
  const [busy, setBusy] = useState(false)
  const [own, setOwn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pick = async (t: string) => {
    const v = t.trim()
    if (!v || busy || disabled) return
    setBusy(true); setError(null)
    try { await send(v, 'text'); markSent(v) } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <section className="dl-deck-card" role="dialog" aria-label="Question for you">
      <header className="dl-deck-head">
        <span className="dl-deck-kicker">{more > 0 ? `1 of ${more + 1}` : 'Your turn'}{more > 0 ? <span className="dl-deck-more">{more} more question{more === 1 ? '' : 's'}</span> : null}</span>
        <button type="button" className="dl-pop-x" aria-label="Minimise question" onClick={onCollapse}><X className="size-4" /></button>
      </header>
      <h2 className="dl-deck-q">{questionOf(text)}</h2>
      <div className="dl-deck-body ui-scroll">
        <div className="dl-opts">
          {suggestions.map((s, i) => (
            <button key={i} type="button" className={`dl-opt ${i === recommended ? 'rec' : ''}`} disabled={busy || disabled} onClick={() => void pick(s)}>
              <span className="dl-key">{KEYS[i] ?? i + 1}</span>
              <span className="min-w-0 flex-1">{s}</span>
              {i === recommended ? <span className="dl-likely">Likely</span> : null}
            </button>
          ))}
        </div>
        <form className="dl-pop-own" onSubmit={(e) => { e.preventDefault(); void pick(own) }}>
          <input value={own} maxLength={4000} disabled={busy || disabled} onChange={(e) => setOwn(e.target.value)} placeholder="Or type or say your own answer…" aria-label="Your own answer" />
          {disabled ? null : <MicButton small onError={setError} onText={(t) => setOwn((o) => (o.trim() ? `${o.trim()} ${t}` : t))} />}
          <button type="submit" className="ui-btn primary" disabled={busy || disabled || !own.trim()}>Send</button>
        </form>
        {error ? <p className="dl-err">{error}</p> : null}
      </div>
      <footer className="dl-deck-foot">
        <button type="button" className="dl-deck-skip" disabled={busy} onClick={() => skip(id)}>{more > 0 ? 'Skip — next question' : 'Skip'}</button>
      </footer>
    </section>
  )
}
