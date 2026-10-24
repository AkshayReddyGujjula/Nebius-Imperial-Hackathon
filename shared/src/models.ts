/** Models offered in the start page's Models menu: all live on Nebius Token Factory (catalogue checked 24 Oct 2026).
 *  Prices are USD per 1M tokens (input / output). `tested` = used in our recorded runs. */
export interface CatalogModel { id: string; name: string; tier: "cheap" | "smart"; in: number; out: number; tested?: boolean }

export const MODEL_CATALOG: CatalogModel[] = [
  { id: "deepseek-ai/DeepSeek-V4.1-Flash-1017", name: "DeepSeek V4.1 Flash (1017)", tier: "cheap", in: 0.30, out: 1.20, tested: true },
  { id: "deepseek-ai/DeepSeek-V4.1-Flash", name: "DeepSeek V4.1 Flash", tier: "cheap", in: 0.30, out: 1.20 },
  { id: "deepseek-ai/DeepSeek-V4-Flash-0731", name: "DeepSeek V4 Flash (0731)", tier: "cheap", in: 0.14, out: 0.28 },
  { id: "MiniMaxAI/MiniMax-M3.1-Flash", name: "MiniMax M3.1 Flash", tier: "cheap", in: 0.15, out: 0.60, tested: true },
  { id: "zai-org/GLM-5.3-Flash", name: "GLM-5.3 Flash", tier: "cheap", in: 0.15, out: 0.50 },
  { id: "openai/gpt-oss-120b", name: "gpt-oss 120B", tier: "cheap", in: 0.15, out: 0.60 },
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", name: "Qwen3 235B A22B", tier: "cheap", in: 0.20, out: 0.60 },
  { id: "Qwen/Qwen3-30B-A3B-Instruct-2507", name: "Qwen3 30B A3B", tier: "cheap", in: 0.10, out: 0.30 },
  { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B", tier: "cheap", in: 0.30, out: 0.90 },
  { id: "google/gemma-3-27b-it", name: "Gemma 3 27B", tier: "cheap", in: 0.10, out: 0.30 },
  { id: "deepseek-ai/DeepSeek-V4-Pro", name: "DeepSeek V4 Pro", tier: "smart", in: 1.75, out: 3.50 },
  { id: "moonshotai/Kimi-K3", name: "Kimi K3", tier: "smart", in: 3.00, out: 15.00 },
  { id: "zai-org/GLM-5.3", name: "GLM-5.3", tier: "smart", in: 1.40, out: 4.40 },
  { id: "nvidia/Nemotron-3-Ultra-550b-a55b", name: "Nemotron 3 Ultra 550B", tier: "smart", in: 1.00, out: 3.00 },
  { id: "MiniMaxAI/MiniMax-M3", name: "MiniMax M3", tier: "smart", in: 0.30, out: 1.20 },
];

export const MODEL_IDS = MODEL_CATALOG.map((m) => m.id);
