import type { CruxEvent } from '@shared/index'

const API = import.meta.env.VITE_API_BASE ?? ''

export function connectRun(
  runId: string,
  onEvent: (e: CruxEvent) => void,
  onError?: () => void,
): () => void {
  const es = new EventSource(`${API}/api/runs/${encodeURIComponent(runId)}/events`)
  es.onmessage = (m) => { try { onEvent(JSON.parse(m.data) as CruxEvent) } catch { /* ignore malformed */ } }
  es.onerror = () => onError?.() // EventSource auto-reconnects with Last-Event-ID
  return () => es.close()
}
