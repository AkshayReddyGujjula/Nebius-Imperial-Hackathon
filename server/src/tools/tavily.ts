import type { Source, SourceRef } from "@shared/index";
import { canonicalUrl, domainOf } from "@shared/ids";
import { CONFIG } from "../config";
import type { RunContext } from "../runs/types";

export interface SearchOutcome {
  searchId: string; query: string;
  sources: Source[];        // this search's results (deduplicated against the run registry), content = THIS result's chunk text
  ms: number; credits: number; error: string | null;
}

const MAX_CONCURRENT = 6;
const TIMEOUT_MS = 15_000;
const REGISTRY_CAP = 6000;
const PROMPT_CAP = 1500;

// ── module-level semaphore (6 concurrent searches across all runs) ──
let active = 0;
const waiters: (() => void)[] = [];
async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return; }
  await new Promise<void>((resolve) => waiters.push(resolve));
}
function release(): void {
  const next = waiters.shift();
  if (next) next(); else active--;
}

interface TavilyResult { title?: string; url: string; content?: string; score?: number; published_date?: string }
interface TavilyResponse { results?: TavilyResult[]; usage?: { credits?: number } }

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

async function callTavily(query: string): Promise<TavilyResponse> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.keys.tavily}` },
    body: JSON.stringify({
      query, search_depth: CONFIG.tavilyDepth, max_results: 5, chunks_per_source: 3,
      include_answer: false, include_raw_content: false, include_images: false, include_usage: true, topic: "general",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, `Tavily HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as TavilyResponse;
}

/** Retry once on 5xx / timeout / network error; never on 4xx. */
async function searchWithRetry(query: string): Promise<TavilyResponse> {
  try {
    return await callTavily(query);
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) throw err;
    return await callTavily(query);
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return `Tavily timed out after ${TIMEOUT_MS / 1000}s`;
    return err.message;
  }
  return String(err);
}

const toRef = (s: Source): SourceRef => ({
  id: s.id, url: s.url, title: s.title, domain: s.domain, score: s.score, publishedDate: s.publishedDate,
});

function mergeChunks(existing: string, incoming: string): string {
  let merged = existing;
  for (const chunk of incoming.split(" [...] ").map((c) => c.trim()).filter(Boolean)) {
    if (merged.length >= REGISTRY_CAP) break;
    if (merged.includes(chunk)) continue;
    merged = merged ? `${merged} [...] ${chunk}` : chunk;
  }
  return merged.slice(0, REGISTRY_CAP);
}

export async function searchAndRegister(ctx: RunContext, agentId: string, round: number, query: string): Promise<SearchOutcome> {
  const searchId = ctx.nextId("search");
  ctx.emit({ type: "search.started", agentId, searchId, round, query });
  const t0 = Date.now();

  let data: TavilyResponse;
  await acquire();
  try {
    data = await searchWithRetry(query);
  } catch (err) {
    const error = errMessage(err);
    const ms = Date.now() - t0;
    ctx.emit({ type: "search.done", agentId, searchId, sources: [], ms, credits: 0, error });
    return { searchId, query, sources: [], ms, credits: 0, error };
  } finally {
    release();
  }

  const st = ctx.state;
  const outcomeSources: Source[] = [];
  const seen = new Set<string>();
  for (const r of data.results ?? []) {
    if (!r?.url) continue;
    const key = canonicalUrl(r.url);
    const content = (r.content ?? "").trim();
    let source: Source | undefined;
    const existingId = st.sourceIdByUrl.get(key);
    if (existingId && (source = st.sources.get(existingId))) {
      source.content = mergeChunks(source.content, content);
    } else {
      source = {
        id: ctx.nextId("source"), url: r.url, title: (r.title ?? "").trim() || domainOf(r.url), domain: domainOf(r.url),
        score: typeof r.score === "number" ? r.score : 0, publishedDate: r.published_date ?? null,
        content: content.slice(0, REGISTRY_CAP),
      };
      st.sources.set(source.id, source);
      st.sourceIdByUrl.set(key, source.id);
    }
    if (seen.has(source.id)) continue;      // same URL twice in one result set
    seen.add(source.id);
    outcomeSources.push({ ...source, content: content.slice(0, PROMPT_CAP) });
  }

  const credits = data.usage?.credits ?? (CONFIG.tavilyDepth === "advanced" ? 2 : 1);
  st.tavily.searches += 1;
  st.tavily.credits += credits;
  const ms = Date.now() - t0;
  ctx.emit({ type: "search.done", agentId, searchId, sources: outcomeSources.map(toRef), ms, credits, error: null });
  ctx.flushStats();
  return { searchId, query, sources: outcomeSources, ms, credits, error: null };
}

/** Caps a Source for the client (`finding.added`): content ≤ 4000 chars. */
export function clientSource(s: Source): Source {
  return s.content.length > 4000 ? { ...s, content: s.content.slice(0, 4000) } : s;
}

function isoDay(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toISOString().slice(0, 10);
}

export function formatBlocks(outcomes: SearchOutcome[]): string {   // §9.2 source block format
  const blocks: string[] = [];
  for (const o of outcomes) {
    if (o.sources.length === 0) { blocks.push(`(no results for "${o.query}")`); continue; }
    for (const s of o.sources) {
      const date = s.publishedDate ? ` · published ${isoDay(s.publishedDate)}` : "";
      blocks.push(`[${s.id}] ${s.title} — ${s.domain}${date}\nURL: ${s.url}\n${s.content.slice(0, PROMPT_CAP)}`);
    }
  }
  return blocks.join("\n\n");
}
