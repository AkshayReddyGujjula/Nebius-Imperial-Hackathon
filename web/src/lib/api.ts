import type {
  BlindSpotAnswerRequest, ClarifyRequest, ClarifyResponse, CreateReplayRequest, CreateRunRequest, CreateRunResponse,
  DeeperRequest, DeeperResponse, FollowupRequest, HealthResponse, LadderRequest,
  LadderResponse, ReplayInfo, SynthesizeRequest, TranscribeResponse,
} from '@shared/api'
import { useCrux } from '@/store/runStore'
import { connectRun } from './sse'

const API = import.meta.env.VITE_API_BASE ?? ''

async function fail(res: Response): Promise<never> {
  let msg = res.statusText || `HTTP ${res.status}`
  try { const body = (await res.json()) as { error?: string }; if (body?.error) msg = body.error } catch { /* not JSON */ }
  throw new Error(msg)
}

async function req<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) return fail(res)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const run = (runId: string) => `/api/runs/${encodeURIComponent(runId)}`

export const getHealth = (): Promise<HealthResponse> => req('GET', '/api/health')
export const createRun = (body: CreateRunRequest): Promise<CreateRunResponse> => req('POST', '/api/runs', body)
/** URL of the run's SSE stream (use `connectRun` from `lib/sse.ts` to subscribe). */
export const runEventsUrl = (runId: string): string => `${API}${run(runId)}/events`
/** URL of the JSONL export (suitable for an `<a href download>`). */
export const exportRunUrl = (runId: string): string => `${API}${run(runId)}/export`
export async function exportRun(runId: string): Promise<string> {
  const res = await fetch(exportRunUrl(runId))
  if (!res.ok) return fail(res)
  return res.text()
}
export const dismissBlindSpot = (runId: string): Promise<void> => req('POST', `${run(runId)}/blindspot/dismiss`, {})
export const listReplays = (): Promise<ReplayInfo[]> => req('GET', '/api/replays')
export const createReplay = (body: CreateReplayRequest): Promise<CreateRunResponse> => req('POST', '/api/replays', body)
export const digDeeper = (runId: string, body: DeeperRequest): Promise<DeeperResponse> => req('POST', `${run(runId)}/deeper`, body)
export const researchBlindSpot = (runId: string): Promise<DeeperResponse> => req('POST', `${run(runId)}/blindspot/research`, {})
export const answerBlindSpot = (runId: string, body: BlindSpotAnswerRequest): Promise<void> => req('POST', `${run(runId)}/blindspot/answer`, body)
export const synthesize = (runId: string, body: SynthesizeRequest): Promise<{ ok: true }> => req('POST', `${run(runId)}/synthesize`, body)
export const runLadder = (runId: string, body: LadderRequest): Promise<LadderResponse> => req('POST', `${run(runId)}/ladder`, body)
export const followup = (runId: string, body: FollowupRequest): Promise<void> => req('POST', `${run(runId)}/followup`, body)
export async function transcribe(audio: Blob): Promise<TranscribeResponse> {
  const form = new FormData()
  form.append('audio', audio, 'speech.webm')
  const res = await fetch(`${API}/api/transcribe`, { method: 'POST', body: form })
  if (!res.ok) return fail(res)
  return (await res.json()) as TranscribeResponse
}

// ---------- run lifecycle ----------

let disconnect: (() => void) | null = null

/** Closes the current SSE connection, if any. */
export function stopRun(): void {
  disconnect?.()
  disconnect = null
}

function attach(runId: string): void {
  const store = useCrux.getState()
  // DECISION: RunData has no setter for runId; ingest adopts the runId from the first event (reducer global rule),
  // so we set it directly here to drop stray events from a previous run.
  useCrux.setState({ runId })
  // EventSource auto-reconnects; if it stays in error for ~8 s without a message, surface a notice.
  let timer: ReturnType<typeof setTimeout> | null = null
  let warned = false
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } warned = false }
  const stopConn = connectRun(
    runId,
    (e) => { clear(); store.ingest(e) },
    () => {
      if (timer || warned) return
      timer = setTimeout(() => {
        warned = true; timer = null
        useCrux.setState((s) => ({
          notices: [...s.notices, { id: `sse-${Date.now()}`, level: 'warn', message: 'Connection to the server was lost — retrying…', ts: Date.now() }],
        }))
      }, 8000)
    },
  )
  disconnect = () => { clear(); stopConn() }
}

// Remembers the live run across a page reload (the server keeps its event log replayable from seq 0).
const ACTIVE_KEY = 'crux.activeRun'

function remember(runId: string, replay: boolean): void {
  try { sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ runId, replay })) } catch { /* storage unavailable */ }
}

/** Forgets the remembered run (called on "New decision"). */
export function forgetActiveRun(): void {
  try { sessionStorage.removeItem(ACTIVE_KEY) } catch { /* storage unavailable */ }
}

/** Reattaches to the run remembered before a reload. Returns false (and forgets it) when there is none or it is gone. */
export async function resumeActiveRun(): Promise<boolean> {
  let runId: string | undefined
  try { runId = (JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? 'null') as { runId?: string } | null)?.runId } catch { /* corrupt */ }
  if (!runId) { forgetActiveRun(); return false }
  try {
    const ctrl = new AbortController()
    const res = await fetch(runEventsUrl(runId), { signal: ctrl.signal })
    ctrl.abort() // only the status matters; the EventSource below replays from seq 0
    if (!res.ok) { forgetActiveRun(); return false }
  } catch { forgetActiveRun(); return false }
  stopRun()
  useCrux.getState().reset()
  attach(runId)
  return true
}

export async function startRun(decision: string, mode: 'text' | 'voice'): Promise<void> {
  stopRun()
  useCrux.getState().reset()
  const { runId } = await createRun({ decision, inputMode: mode })
  remember(runId, false)
  attach(runId)
}

export async function startReplay(file: string, speed?: number): Promise<void> {
  stopRun()
  useCrux.getState().reset()
  const { runId } = await createReplay(speed === undefined ? { file } : { file, speed })
  remember(runId, true)
  attach(runId)
}

/** Current mutating calls need the active runId; returns null when there is no live run. */
export const currentRunId = (): string | null => useCrux.getState().runId

/** Phase 0 name kept for compatibility: raw fetch of the SSE stream (prefer `connectRun`). */
export const getRunEvents = (runId: string): Promise<Response> => fetch(runEventsUrl(runId))

/** Pre-run interview: 2–4 clarifying questions for the decision. Aborts after `timeoutMs`. */
export async function clarify(body: ClarifyRequest, timeoutMs = 25_000): Promise<ClarifyResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API}/api/clarify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal,
    })
    if (!res.ok) return fail(res)
    return (await res.json()) as ClarifyResponse
  } finally { clearTimeout(timer) }
}
