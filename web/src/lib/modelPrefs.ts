import type { RunModels } from '@shared/api'
import { MODEL_CATALOG } from '@shared/models'

const CHOICES = MODEL_CATALOG.map((m) => ({ id: m.id, name: `${m.name} — $${m.in}/$${m.out}${m.tier === 'smart' ? ' · smart' : ''}${m.tested ? ' · tested' : ''}` }))
export const MODEL_CHOICES = { orchestrator: CHOICES, agent: CHOICES, audit: CHOICES }

export interface Preset { id: string; name: string; why: string; models: Required<RunModels> }

export const PRESETS: Preset[] = [
  { id: 'recommended', name: 'Recommended',
    why: 'DeepSeek plans and researches (best tool-calling for the price); MiniMax, a different model family, reviews for contradictions.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', audit: 'MiniMaxAI/MiniMax-M3.1-Flash' } },
  { id: 'third-family', name: 'Third-family reviewer',
    why: 'The review comes from GLM, yet another lab, for an extra independence check.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', audit: 'zai-org/GLM-5.3-Flash' } },
  { id: 'smart', name: 'Maximum quality',
    why: 'GLM-5.3 plans and researches, Kimi K3 reviews. Bigger, slower and several times the cost.',
    models: { orchestrator: 'zai-org/GLM-5.3', agent: 'zai-org/GLM-5.3', audit: 'moonshotai/Kimi-K3' } },
  { id: 'previous', name: 'Previous DeepSeek build',
    why: 'The older DeepSeek V4.1 Flash for planning and research, to compare. It guesses more often (4% vs 33% non-hallucination).',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash', agent: 'deepseek-ai/DeepSeek-V4.1-Flash', audit: 'MiniMaxAI/MiniMax-M3.1-Flash' } },
]

const KEY = 'dl-run-models'

export function getRunModels(): Required<RunModels> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const ok = (id: unknown) => MODEL_CATALOG.some((m) => m.id === id)
    if (ok(v?.orchestrator) && ok(v?.agent) && ok(v?.audit)) return v
  } catch { /* ignore */ }
  return PRESETS[0].models
}

export function setRunModels(m: Required<RunModels>): void { localStorage.setItem(KEY, JSON.stringify(m)) }
