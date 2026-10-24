import { useShallow } from 'zustand/react/shallow'
import { selectQuestionTrust } from '@/store/selectors'
import { useCrux } from '@/store/runStore'
import { Dot } from './StatusDot'

/** §4.4 trust line: "{n} sources · all quotes checked" / "{k} of {n} quotes couldn't be verified". */
export function trustText(t: { sources: number; findings: number; unverified: number }, disagreesWith: string[]): string {
  let text = t.unverified === 0
    ? `${t.sources} source${t.sources === 1 ? '' : 's'} · all quotes checked`
    : `${t.unverified} of ${t.findings} quotes couldn't be verified`
  if (disagreesWith.length) text += ` · disagrees with ${disagreesWith.join(', ')}`
  return text
}

export function TrustLine({ questionId }: { questionId: string }) {
  const trust = useCrux(useShallow((s) => selectQuestionTrust(s, questionId)))
  const disagrees = useCrux(useShallow((s) => {
    const mine = new Set(Object.values(s.findings).filter((f) => f.questionId === questionId).map((f) => f.id))
    const others = new Set<string>()
    for (const x of s.contradictions) {
      const [a, b] = x.findingIds
      const other = mine.has(a) ? b : mine.has(b) ? a : null
      const qid = other ? s.findings[other]?.questionId : null
      if (qid && qid !== questionId) {
        const idx = s.plan?.questions.findIndex((q) => q.id === qid) ?? -1
        if (idx >= 0) others.add(`Q${idx + 1}`)
      }
    }
    return [...others]
  }))
  if (trust.findings === 0) return null
  const tone = trust.unverified > 0 || disagrees.length > 0 ? 'warn' : 'ok'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] leading-4 ${tone === 'ok' ? 'text-crux-ok' : 'text-crux-warn'}`}>
      <Dot kind={tone} />
      {trustText(trust, disagrees)}
    </span>
  )
}
