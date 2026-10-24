import type { ReactNode } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { AgentStatus, Usage } from '@shared/index'
import { useCrux } from '@/store/runStore'
import type { CruxStore } from '@/store/types'
import { fmtMs, fmtTokens, fmtUsd } from '@/lib/format'

export function Header({ kind, onClose, children }: { kind: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-2 border-b border-crux-border px-4 py-3">
      <div className="ui-label flex-1">{kind}</div>
      {children}
      <button type="button" className="ui-btn ghost sm icon" onClick={onClose} aria-label="Close inspector" title="Close (Esc)"><X /></button>
    </div>
  )
}

export function Sec({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-insp-sec">
      {title ? <div className="mb-2 flex items-center gap-2"><div className="ui-label flex-1">{title}</div>{aside}</div> : null}
      {children}
    </section>
  )
}

export function UsageLine({ usage }: { usage: Usage | null | undefined }) {
  if (!usage) return null
  return (
    <p className="ui-num text-[12px] leading-4 text-crux-text-tertiary">
      {fmtTokens(usage.inputTokens + usage.outputTokens)} tokens · {fmtTokens(usage.reasoningTokens)} reasoning · {fmtUsd(usage.costUsd)} · {fmtMs(usage.ms)}
    </p>
  )
}

/** Collapsed, streaming raw reasoning (Detailed only). */
export function RawReasoning({ actorId, label }: { actorId: string; label: string }) {
  const raw = useCrux((s) => s.reasoning[actorId]?.raw ?? '')
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-crux-text-secondary select-none hover:text-crux-text">
        <ChevronRight className="!size-3.5 transition-transform group-open:rotate-90" />
        Raw model reasoning · {label}
        <span className="ui-num font-normal text-crux-text-quaternary">{raw ? `${raw.length.toLocaleString()} chars` : ''}</span>
      </summary>
      <pre className="ui-raw ui-scroll mt-2">{raw || 'No reasoning streamed for this step.'}</pre>
    </details>
  )
}

/** §4.4 agent status copy (Simple). */
export function statusCopy(s: CruxStore, agentId: string | undefined): string {
  const a = agentId ? s.agents[agentId] : undefined
  if (!a) return 'Waiting to start'
  const st: AgentStatus = a.status
  switch (st) {
    case 'queued': return 'Waiting to start'
    case 'searching': return 'Searching the web…'
    case 'reading': return `Reading ${a.sourcesRead} sources…`
    case 'thinking': return s.reasoning[a.id]?.summary ?? 'Thinking…'
    case 'writing': return 'Writing up findings…'
    case 'done': return 'Done'
    case 'failed': return `Couldn't finish — ${a.error ?? a.note ?? 'unknown error'}`
    case 'timeout': return 'Ran out of time — partial results'
  }
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((t, i) => (
        <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2 text-[13px] leading-[19px] text-crux-text-secondary">
          <span className="mt-[8px] size-1 rounded-full bg-crux-text-quaternary" />{t}
        </li>
      ))}
    </ul>
  )
}
