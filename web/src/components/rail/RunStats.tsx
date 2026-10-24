import { useCrux } from '@/store/runStore'
import { fmtMs, fmtTokens, fmtUsd } from '@/lib/format'

/** Detailed: 2×2 KPI grid + parallelism line (§13.4). */
export function RunStats() {
  const stats = useCrux((s) => s.stats)
  const k = (l: string, v: string, muted = false) => (
    <div className="ui-kpi">
      <div className="l">{l}</div>
      <div className={`v ${muted ? '!text-crux-text-tertiary' : ''}`}>{v}</div>
    </div>
  )
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {k('Tokens', stats ? fmtTokens(stats.inputTokens + stats.outputTokens) : '–')}
        {k('Cost', stats ? fmtUsd(stats.costUsd) : '–')}
        {k('Wall-clock', stats ? fmtMs(stats.wallMs) : '–')}
        {k('Sequential', stats ? fmtMs(stats.agentMsSum) : '–', true)}
      </div>
      {stats ? (
        <p className="ui-num mt-2 text-[12px] leading-4 text-crux-text-tertiary">
          {stats.speedup.toFixed(1)}× faster in parallel · {stats.llmCalls} model calls · {stats.tavilySearches} searches
        </p>
      ) : null}
    </div>
  )
}
