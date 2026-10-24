export const MAX_DECISION = 4000
export const ANSWERS_HEADER = '\n\nAbout me (answers to clarifying questions):\n'

export interface Answered { question: string; answer: string }

/** Original text + one `- <question> <answer>` line per answered question, capped at 4000 chars by trimming answers. */
export function composeDecision(original: string, answered: Answered[], max = MAX_DECISION): string {
  const items = answered
    .map((a) => ({ q: a.question.trim(), a: a.answer.trim().replace(/\s+/g, ' ') }))
    .filter((a) => a.a.length > 0)
  if (items.length === 0) return original.slice(0, max)
  const line = (q: string, a: string) => `- ${q} ${a}`
  const build = (list: { q: string; a: string }[]) => original + ANSWERS_HEADER + list.map((x) => line(x.q, x.a)).join('\n')
  let out = build(items)
  if (out.length <= max) return out

  // Share what's left between the answers; drop trailing lines if even the questions don't fit.
  let list = items
  while (list.length > 0) {
    const fixed = original.length + ANSWERS_HEADER.length + list.reduce((n, x) => n + line(x.q, '').length, 0) + (list.length - 1)
    const per = Math.floor((max - fixed) / list.length)
    if (per >= 12) {
      out = build(list.map((x) => ({ q: x.q, a: x.a.length > per ? `${x.a.slice(0, per - 1).trimEnd()}…` : x.a })))
      if (out.length <= max) return out
    }
    list = list.slice(0, -1)
  }
  return original.slice(0, max)
}
