import type {
  BlindSpotAnswerRequest, CreateReplayRequest, CreateRunRequest, CreateRunResponse,
  DeeperRequest, DeeperResponse, FollowupRequest, HealthResponse, LadderRequest,
  LadderResponse, ReplayInfo, SynthesizeRequest, TranscribeResponse,
} from '@shared/api'

const API = import.meta.env.VITE_API_BASE ?? ''

// Phase 0 stubs: Lane W3 replaces these with fetch and connection lifecycle code.
function pending<T>(..._args: unknown[]): Promise<T> {
  return Promise.reject(new Error('API client is not implemented yet (Phase 0 skeleton).'))
}

export const getHealth = (): Promise<HealthResponse> => pending(API)
export const createRun = (body: CreateRunRequest): Promise<CreateRunResponse> => pending(API, body)
export const getRunEvents = (runId: string): Promise<Response> => pending(API, runId)
export const exportRun = (runId: string): Promise<string> => pending(API, runId)
export const dismissBlindSpot = (runId: string): Promise<void> => pending(API, runId)
export const listReplays = (): Promise<ReplayInfo[]> => pending(API)
export const createReplay = (body: CreateReplayRequest): Promise<CreateRunResponse> => pending(API, body)
export const digDeeper = (runId: string, body: DeeperRequest): Promise<DeeperResponse> => pending(API, runId, body)
export const researchBlindSpot = (runId: string): Promise<DeeperResponse> => pending(API, runId)
export const answerBlindSpot = (runId: string, body: BlindSpotAnswerRequest): Promise<void> => pending(API, runId, body)
export const synthesize = (runId: string, body: SynthesizeRequest): Promise<{ ok: true }> => pending(API, runId, body)
export const runLadder = (runId: string, body: LadderRequest): Promise<LadderResponse> => pending(API, runId, body)
export const transcribe = (audio: Blob): Promise<TranscribeResponse> => pending(API, audio)
export const followup = (runId: string, body: FollowupRequest): Promise<void> => pending(API, runId, body)

export function startRun(decision: string, mode: 'text' | 'voice'): Promise<void> {
  return pending(API, decision, mode)
}

export function startReplay(file: string): Promise<void> {
  return pending(API, file)
}
