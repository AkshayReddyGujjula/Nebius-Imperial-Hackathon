/** Cut text to at most `max` words at a word boundary; strips citations like [f3] or (f3, f4). */
export function clip(text: string, max: number): string {
  const clean = text
    .replace(/\s*[[(](?:f|s|src|source)?\d+(?:\s*,\s*(?:f|s|src|source)?\d+)*[\])]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const first = clean.split(/(?<=[.!?;])\s/)[0].replace(/[.;:,]$/, '')
  const words = first.split(' ').filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ').replace(/[,;:—–-]+$/, '') + '…'
}

/** "If you value X, then Y" / "If X, Y" → { care: X, pick: Y }. */
export function splitIf(c: string): { care: string; pick: string } | null {
  const m = /^\s*if\s+(.+?),\s*(?:then\s+)?(.+)$/i.exec(c)
  if (!m) return null
  const care = m[1].replace(/^(?:you\s+)?(?:value|care (?:most )?about|prioriti[sz]e)\s+/i, '').replace(/\s+(?:most|above all|the most)$/i, '')
  const pick = m[2].split(/\s+[—–]\s+|\s+-\s+/)[0].replace(/^(?:you should\s+|choose\s+|pick\s+|go with\s+)/i, '')
    .replace(/\s+(?:fits|is|works)\s+(?:best|better)\b.*$/i, '')
  return { care, pick }
}
