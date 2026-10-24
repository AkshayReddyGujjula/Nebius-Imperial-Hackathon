import { create } from 'zustand'
import { useCrux } from '@/store/runStore'
import { sendChat } from '@/lib/api'

type Chat = ReturnType<typeof useCrux.getState>['chat']
export type Pending = { text: string; users: number; assistants: number; at: number }

/** UI state shared by the rail and the centred question deck. */
export const useChatUi = create<{
  pending: Pending | null
  skipped: string[]
  deckOpen: boolean
  markSent: (text: string) => void
  skip: (id: string) => void
  setDeckOpen: (open: boolean) => void
}>((set) => ({
  pending: null,
  skipped: [],
  deckOpen: true,
  markSent: (text) => {
    const chat = useCrux.getState().chat
    const users = chat.filter((m) => m.role === 'user').length
    set({ pending: { text, users, assistants: chat.length - users, at: Date.now() }, deckOpen: true })
  },
  skip: (id) => set((s) => ({ skipped: [...s.skipped, id] })),
  setDeckOpen: (deckOpen) => set({ deckOpen }),
}))

/** Assistant questions still waiting on the user: after the last user message, not skipped, not just answered. */
export function openQuestions(chat: Chat, pending: Pending | null, skipped: string[]): Chat {
  let lastUser = -1
  chat.forEach((m, i) => { if (m.role === 'user') lastUser = i })
  const assistants = chat.filter((m) => m.role === 'assistant').length
  if (pending && pending.assistants >= assistants) return []
  return chat.filter((m, i) => i > lastUser && m.role === 'assistant' && m.suggestions.length > 0 && !skipped.includes(m.id))
}

export async function send(text: string, mode: 'text' | 'voice'): Promise<void> {
  const runId = useCrux.getState().runId
  if (!runId) throw new Error('No live conversation')
  await sendChat(runId, text, mode)
}

export const errText = (e: unknown) => `Couldn't send — ${e instanceof Error ? e.message : 'server unreachable'}.`

/** Sentences of a reply, keeping list lines intact. */
export function sentences(text: string): string[] {
  return text.split(/\n+/).flatMap((line) => {
    const l = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
    if (!l) return []
    return (l.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [l]).map((s) => s.trim()).filter(Boolean)
  })
}

/** The question: last sentence ending in "?". */
export function questionOf(text: string): string {
  const q = [...sentences(text)].reverse().find((p) => p.endsWith('?'))
  return q ?? 'Your answer'
}

/** "If you value X, Y" / "If X → Y" → two-part chip. */
export function conditional(s: string): { when: string; then: string } | null {
  const m = /^if\s+(?:you\s+(?:value|care\s+(?:most\s+)?about|prefer|want|need)\s+)?(.{3,80}?)\s*(?:→|->|,|—|then)\s*(?:then\s+)?(.{3,})$/i.exec(s)
  if (!m) return null
  return { when: m[1].trim(), then: m[2].replace(/[.!]+$/, '').trim() }
}
