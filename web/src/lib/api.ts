import type {
  BlindSpotAnswerRequest, CreateReplayRequest, CreateRunRequest, CreateRunResponse,
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
  disconnect = connectRun(runId, store.ingest)
}

export async function startRun(decision: string, mode: 'text' | 'voice'): Promise<void> {
  stopRun()
  useCrux.getState().reset()
  const { runId } = await createRun({ decision, inputMode: mode })
  attach(runId)
}

export async function startReplay(file: string, speed?: number): Promise<void> {
  stopRun()
  useCrux.getState().reset()
  const { runId } = await createReplay(speed === undefined ? { file } : { file, speed })
  attach(runId)
}

/** Current mutating calls need the active runId; returns null when there is no live run. */
export const currentRunId = (): string | null => useCrux.getState().runId

/** Phase 0 name kept for compatibility: raw fetch of the SSE stream (prefer `connectRun`). */
export const getRunEvents = (runId: string): Promise<Response> => fetch(runEventsUrl(runId))
