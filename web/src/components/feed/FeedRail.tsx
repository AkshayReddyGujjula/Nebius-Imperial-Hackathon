import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import {
  BookMarked, CheckCheck, ChevronsRight, CircleHelp, Info, ListTree, MessageSquareText, PanelRightOpen, PenLine, Quote, ShieldCheck,
} from 'lucide-react'
import { useCrux } from '@/store/runStore'
import { buildFeed, type FeedActor, type FeedItem } from './buildFeed'
import { useFeedUi } from './feedUi'
import { FeedStats } from './FeedStats'
import './feed.css'

const STREAM_LIMIT = 80

function useFeed(): FeedItem[] {
  const { feedLog, agents, plan, findings, chat, sources } = useCrux(useShallow((s) => ({
    feedLog: s.feedLog, agents: s.agents, plan: s.plan, findings: s.findings, chat: s.chat, sources: s.sources,
  })))
  return useMemo(() => buildFeed(feedLog, { agents, plan, findings, chat, sources }), [feedLog, agents, plan, findings, chat, sources])
}

export function FeedRail() {
  const items = useFeed()
  const runId = useCrux((s) => s.runId)
  const { open, seen, setOpen, markSeen, clear } = useFeedUi()
  useEffect(() => { clear() }, [runId, clear])

  const attention = useMemo(() => items
    .filter((it) => it.priority === 3 && !seen[it.id])
    .sort((a, b) => b.ts - a.ts), [items, seen])
  const stream = useMemo(() => items.slice(-STREAM_LIMIT).reverse(), [items])

  if (!open) {
    return (
      <aside aria-label="Live feed (collapsed)" className="dl-feed dl-feed-strip">
        <button type="button" className="dl-feed-iconbtn" onClick={() => setOpen(true)} title="Open the live feed" aria-label="Open the live feed">
          <PanelRightOpen size={16} />
        </button>
        {attention.length ? <span className="dl-feed-bang dl-feed-bang-count" title={`${attention.length} need your attention`}>{attention.length}</span> : null}
        <span className="dl-feed-strip-label">Live feed</span>
      </aside>
    )
  }

  return (
    <aside aria-label="Live feed" className="dl-feed">
      <header className="dl-feed-head">
        <div className="min-w-0">
          <div className="dl-feed-title"><span className="dl-feed-live" aria-hidden /> Live feed</div>
          <div className="dl-feed-sub">what the agents are doing</div>
        </div>
        <button type="button" className="dl-feed-iconbtn" onClick={() => setOpen(false)} title="Collapse" aria-label="Collapse the live feed">
          <ChevronsRight size={16} />
        </button>
      </header>
      <div className="dl-feed-scroll">
        <FeedStats />
        {attention.length ? (
          <section className="dl-feed-section dl-feed-attn" aria-label="Needs your attention">
            <div className="dl-feed-label">
              <span>Needs your attention · {attention.length}</span>
              <button type="button" className="dl-feed-link" onClick={() => markSeen(attention.map((a) => a.id))}>
                <CheckCheck size={12} /> Mark all seen
              </button>
            </div>
            <CardList items={attention} seen={seen} pinned />
          </section>
        ) : null}
        <section className="dl-feed-section" aria-label="Everything, newest first">
          <div className="dl-feed-label"><span>Everything · newest first</span><span className="ui-num">{items.length}</span></div>
          {stream.length ? <CardList items={stream} seen={seen} /> : <p className="dl-feed-empty">Waiting for the first agent…</p>}
        </section>
      </div>
    </aside>
  )
}

function CardList({ items, seen, pinned = false }: { items: FeedItem[]; seen: Record<string, true>; pinned?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <ul className="dl-feed-list">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.li key={it.id} layout={reduce ? false : 'position'}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 16, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
            <FeedCard item={it} unseen={!seen[it.id] && it.priority >= 2} pinned={pinned} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function FeedCard({ item, unseen, pinned }: { item: FeedItem; unseen: boolean; pinned: boolean }) {
  const select = useCrux((s) => s.select)
  const markSeen = useFeedUi((s) => s.markSeen)
  const onClick = () => {
    markSeen([item.id])
    if (item.nodeId) select(item.nodeId)
  }
  return (
    <button type="button" onClick={onClick}
      className={`dl-feed-card tone-${item.tone} ${pinned ? 'is-pinned' : ''} ${item.priority === 0 ? 'is-quiet' : ''}`}
      title={item.nodeId ? 'Show on the canvas' : undefined}>
      <Avatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        <div className="dl-feed-meta">
          <span className="dl-feed-actor">{item.actor.label}</span>
          {item.actor.model ? <span className="dl-feed-model">· {item.actor.model}</span> : null}
          <span className="dl-feed-time ui-num">{new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="dl-feed-card-title">{item.title}</div>
        {item.body ? <p className={`dl-feed-body ${item.mono ? 'is-mono' : ''}`}>{item.body}</p> : null}
        {item.quote ? <blockquote className="dl-feed-quote">“{item.quote}”</blockquote> : null}
        {item.chips.length ? (
          <div className="dl-feed-chips">
            {item.chips.map((c) => <span key={c.label} className={`dl-feed-chip tone-${c.tone}`}>{c.label}</span>)}
          </div>
        ) : null}
      </div>
      {unseen ? <span className="dl-feed-bang" aria-label="New">!</span> : null}
    </button>
  )
}

function Avatar({ actor }: { actor: FeedActor }) {
  const icon = {
    planner: <ListTree size={13} />, auditor: <ShieldCheck size={13} />, narrator: <MessageSquareText size={13} />,
    writer: <PenLine size={13} />, memory: <BookMarked size={13} />, check: <Quote size={12} />,
    system: <Info size={13} />, you: <CircleHelp size={13} />, agent: null,
  }[actor.kind]
  return (
    <span className={`dl-feed-avatar kind-${actor.kind}`} aria-hidden>
      {icon ?? <span className="ui-num">{actor.index ?? 'A'}</span>}
    </span>
  )
}
