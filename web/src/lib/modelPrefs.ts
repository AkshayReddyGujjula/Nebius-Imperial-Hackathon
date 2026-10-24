import type { RunModels } from '@shared/api'

export const MODEL_CHOICES = {
  orchestrator: [
    { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', name: 'DeepSeek V4.1 Flash (1017)' },
    { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash' },
  ],
  agent: [
    { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', name: 'DeepSeek V4.1 Flash (1017)' },
    { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash' },
  ],
  audit: [
    { id: 'MiniMaxAI/MiniMax-M3.1-Flash', name: 'MiniMax M3.1 Flash' },
    { id: 'zai-org/GLM-5.3-Flash', name: 'GLM-5.3 Flash' },
    { id: 'Qwen/Qwen3-30B-A3B-Instruct-2507', name: 'Qwen3 30B A3B' },
  ],
} as const

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
