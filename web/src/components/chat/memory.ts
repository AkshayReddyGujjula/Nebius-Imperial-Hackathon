export type MemoryLine =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'text'; text: string }

/** Parses user.md into headings, bullets and plain lines (the title heading `# …` is dropped). */
export function parseMemory(md: string): MemoryLine[] {
  const out: MemoryLine[] = []
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) { if (h[1].length > 1) out.push({ kind: 'heading', text: h[2] }); continue }
    const b = /^[-*+]\s+(.*)$/.exec(line)
    if (b) { out.push({ kind: 'bullet', text: b[1] }); continue }
    out.push({ kind: 'text', text: line })
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/^[-*+]\s+/, '').replace(/\s+/g, ' ').trim()

/** True when a memory line is one of the latest changes (loose match either way). */
export function isChanged(text: string, changes: string[]): boolean {
  const t = norm(text)
  if (!t) return false
  return changes.some((c) => { const n = norm(c); return n.length > 0 && (t.includes(n) || n.includes(t)) })
}

export const countFacts = (lines: MemoryLine[]): number => lines.filter((l) => l.kind !== 'heading').length
