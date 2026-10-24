import { create } from 'zustand'

/** Feed-local UI state: which cards were seen, and whether the rail is collapsed. */
interface FeedUi {
  open: boolean
  seen: Record<string, true>
  setOpen(open: boolean): void
  markSeen(ids: string[]): void
  clear(): void
}

function savedOpen(): boolean {
  try {
    const v = localStorage.getItem('dl.feedOpen')
    if (v !== null) return v === '1'
  } catch { /* Storage may be unavailable. */ }
  return true
}

export const useFeedUi = create<FeedUi>()((set) => ({
  open: savedOpen(),
  seen: {},
  setOpen: (open) => {
    try { localStorage.setItem('dl.feedOpen', open ? '1' : '0') } catch { /* ignore */ }
    set({ open })
  },
  markSeen: (ids) => set((s) => {
    if (ids.every((id) => s.seen[id])) return s
    const seen = { ...s.seen }
    for (const id of ids) seen[id] = true
    return { seen }
  }),
  clear: () => set({ seen: {} }),
}))
