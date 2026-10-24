import type { RunModels } from '@shared/api'
import { MODEL_CATALOG } from '@shared/models'

const CHOICES = MODEL_CATALOG.map((m) => ({ id: m.id, name: `${m.name} · ${m.tier === 'smart' ? 'smart' : 'cheap'} · $${m.in}/$${m.out}${m.tested ? ' · tested' : ''}` }))
export const MODEL_CHOICES = { orchestrator: CHOICES, agent: CHOICES, audit: CHOICES }

export interface Preset { id: string; name: string; why: string; models: Required<RunModels> }

export const PRESETS: Preset[] = [
  { id: 'recommended', name: 'Recommended',
    why: 'DeepSeek plans and researches (best tool-calling for the price); MiniMax, a different model family, reviews for contradictions.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', audit: 'MiniMaxAI/MiniMax-M3.1-Flash' } },
  { id: 'third-family', name: 'Third-family reviewer',
    why: 'The review comes from GLM, yet another lab, for an extra independence check.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', audit: 'zai-org/GLM-5.3-Flash' } },
  { id: 'budget', name: 'Budget reviewer',
    why: 'Qwen3 30B, a small mixture-of-experts model, reviews at about a third of the price of MiniMax.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', audit: 'Qwen/Qwen3-30B-A3B-Instruct-2507' } },
  { id: 'smart', name: 'Maximum quality',
    why: 'DeepSeek V4 Pro plans and researches, Kimi K3 reviews. Bigger, slower and roughly 5–10× the cost.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4-Pro', agent: 'deepseek-ai/DeepSeek-V4-Pro', audit: 'moonshotai/Kimi-K3' } },
  { id: 'cheapest', name: 'Cheapest',
    why: 'DeepSeek V4 Flash (0731) at $0.14/$0.28 per 1M tokens researches; Gemma 3 27B reviews. Lowest cost, less careful.',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', agent: 'deepseek-ai/DeepSeek-V4-Flash-0731', audit: 'google/gemma-3-27b-it' } },
  { id: 'previous', name: 'Previous DeepSeek build',
    why: 'The older DeepSeek V4.1 Flash for planning and research, to compare. It guesses more often (4% vs 33% non-hallucination).',
    models: { orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash', agent: 'deepseek-ai/DeepSeek-V4.1-Flash', audit: 'MiniMaxAI/MiniMax-M3.1-Flash' } },
]

const KEY = 'dl-run-models'

export function getRunModels(): Required<RunModels> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v?.orchestrator && v?.agent && v?.audit) return v
  } catch { /* ignore */ }
  return PRESETS[0].models
}

export function setRunModels(m: Required<RunModels>): void { localStorage.setItem(KEY, JSON.stringify(m)) }
