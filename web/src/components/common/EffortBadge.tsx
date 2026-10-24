import type { Effort } from '@shared/index'

const FILLED: Record<Effort, number> = { low: 1, high: 2, max: 3 }
const WORD: Record<Effort, string> = { low: 'Low', high: 'High', max: 'Max' }

export function EffortBadge({ effort, reason }: { effort: Effort; reason?: string | null }) {
  const n = FILLED[effort]
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="cx-eff" aria-label={`${WORD[effort]} effort`}>
        <i>{[0, 1, 2].map((i) => <s key={i} className={i < n ? 'on' : undefined} />)}</i>
        {WORD[effort]}
      </span>
      {reason ? <span className="min-w-0 truncate text-[12px] text-crux-text-tertiary">{reason}</span> : null}
    </span>
  )
}

export const effortWord = (e: Effort) => WORD[e]
