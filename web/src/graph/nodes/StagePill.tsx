import type { ReactNode } from 'react'
import { CircleCheck, Clock, LoaderCircle, TriangleAlert } from 'lucide-react'

/** The one state vocabulary every stage node (memory, quote check, auditor) uses in Simple mode. */
export type StageState = 'waiting' | 'working' | 'ok' | 'attention'

const ICON: Record<StageState, ReactNode> = {
  waiting: <Clock />,
  working: <LoaderCircle className="cx-spin" />,
  ok: <CircleCheck />,
  attention: <TriangleAlert />,
}

/** One short line: icon + "Name · state". Colour comes from the state. */
export function StagePill({ state, name, text, title }: { state: StageState; name: string; text: string; title?: string }) {
  return (
    <div className={`cx-stage cx-stage-${state}`} title={title ?? `${name} · ${text}`}>
      {ICON[state]}
      <b>{name}</b>
      <span className="cx-stage-sep">·</span>
      <span className="cx-ellipsis">{text}</span>
    </div>
  )
}

/** First n words, with an ellipsis if cut. */
export function firstWords(text: string, n: number): string {
  const w = text.trim().split(/\s+/)
  return w.length <= n ? text.trim() : `${w.slice(0, n).join(' ')}…`
}
