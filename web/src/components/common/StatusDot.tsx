import type { AgentStatus } from '@shared/index'
import type { ActivityTone } from '@/store/types'
import { cn } from '@/lib/utils'

export type DotKind = 'queued' | 'active' | 'ok' | 'bad' | 'warn' | 'neutral'

export function dotForStatus(status: AgentStatus | null | undefined): DotKind {
  switch (status) {
    case 'searching': case 'reading': case 'thinking': case 'writing': return 'active'
    case 'done': return 'ok'
    case 'failed': case 'timeout': return 'bad'
    default: return 'queued'
  }
}

export function dotForTone(tone: ActivityTone): DotKind {
  return tone === 'accent' ? 'active' : tone
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  queued: 'Queued', searching: 'Searching', reading: 'Reading', thinking: 'Thinking',
  writing: 'Writing', done: 'Done', failed: 'Failed', timeout: 'Timed out',
}

export function Dot({ kind, className }: { kind: DotKind; className?: string }) {
  return <span aria-hidden className={cn('ui-dot', kind, className)} />
}

/** Status dot with its text label — the dot never appears without words. */
export function StatusDot({ status, label, className }: { status: AgentStatus | null; label?: string; className?: string }) {
  const kind = dotForStatus(status)
  return (
    <span className={cn('ui-st', kind, className)}>
      <Dot kind={kind} />
      {label ?? (status ? STATUS_LABEL[status] : 'Queued')}
    </span>
  )
}
