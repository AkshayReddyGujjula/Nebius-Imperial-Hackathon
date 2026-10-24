import type { CruxEvent } from '@shared/index'

const API = import.meta.env.VITE_API_BASE ?? ''

export function connectRun(
  runId: string,
  onEvent: (e: CruxEvent) => void,
  onError?: () => void,
): () => void {
  // Phase 0 stub: Lane W3 replaces this with EventSource wiring.
  void API; void runId; void onEvent; void onError
  return () => {}
}
