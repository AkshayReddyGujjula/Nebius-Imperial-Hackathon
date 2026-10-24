import { CONFIG } from "../config";
import type { RunContext } from "../runs/types";
import { SUMMARY_SYSTEM } from "../pipeline/prompts";
import { streamChat } from "./nebius";

interface ActorState {
  buffer: string;
  pending: string;
  flushTimer: NodeJS.Timeout | null;
  tick: NodeJS.Timeout | null;
  inFlight: boolean;
  lastAt: number;
  sinceLast: number;
  active: boolean;
}

const BUFFER_MAX = 20_000, CHUNK_MS = 300, CHUNK_MAX = 2000, MIN_GAP_MS = 4000, MIN_NEW_CHARS = 400;

/** First line only; strip quotes, asterisks and the trailing period; max 80 chars. Empty → "" (skip). */
export function cleanSummary(text: string): string {
  let s = (text ?? "").trim().split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  s = s.replace(/["“”'‘’*`]/g, "").trim().replace(/\.+$/, "").trim();
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s;
}

/** One per run. Streams reasoning chunks and best-effort one-line summaries (§9.1). */
export class Summarizer {
  private actors = new Map<string, ActorState>();
  private closed = false;
  constructor(private ctx: RunContext) {}

  private actor(id: string): ActorState {
    let a = this.actors.get(id);
    if (!a) {
      a = { buffer: "", pending: "", flushTimer: null, tick: null, inFlight: false, lastAt: 0, sinceLast: 0, active: true };
      this.actors.set(id, a);
    }
    a.active = true;   // an actor id can be reused (orchestrator: plan, then synthesis)
    if (!a.tick) a.tick = setInterval(() => this.maybeSummarize(id), 1000);
    return a;
  }

  feed(actorId: string, delta: string): void {
    if (this.closed || !delta) return;
    const a = this.actor(actorId);
    a.buffer = (a.buffer + delta).slice(-BUFFER_MAX);
    a.sinceLast += delta.length;
    a.pending += delta;
    if (a.pending.length > CHUNK_MAX) this.flush(actorId);
    else if (!a.flushTimer) a.flushTimer = setTimeout(() => this.flush(actorId), CHUNK_MS);
    this.maybeSummarize(actorId);
  }

  private flush(actorId: string): void {
    const a = this.actors.get(actorId);
    if (!a) return;
    if (a.flushTimer) { clearTimeout(a.flushTimer); a.flushTimer = null; }
    if (!a.pending) return;
    const text = a.pending; a.pending = "";
    this.ctx.emit({ type: "reasoning.chunk", actorId, text });
  }

  end(actorId: string): void {
    const a = this.actors.get(actorId);
    if (!a) return;
    this.flush(actorId);
    a.active = false;
    if (a.tick) { clearInterval(a.tick); a.tick = null; }
    a.sinceLast = 0;
  }

  private maybeSummarize(actorId: string): void {
    const a = this.actors.get(actorId);
    if (!a || !a.active || this.closed || a.inFlight) return;
    if (Date.now() - a.lastAt < MIN_GAP_MS || a.sinceLast < MIN_NEW_CHARS) return;
    const p = streamChat({
      bestEffort: true, model: CONFIG.models.summary,
      reasoningEffort: CONFIG.summaryEffort === "omit" ? undefined : "none",
      maxTokens: 40, timeoutMs: 6000,
      messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: a.buffer.slice(-1500) }],
    });
    if (!p) return;   // limiter busy or window near cap: skip, try again on the next feed/tick
    a.inFlight = true; a.lastAt = Date.now(); a.sinceLast = 0;
    p.then((res) => {
      this.ctx.recordUsage("summarizer", res.usage, null);
      const text = cleanSummary(res.content);   // empty / whitespace-only reply → skip (smoke override)
      if (text && a.active && !this.closed) this.ctx.emit({ type: "reasoning.summary", actorId, text });
    }).catch(() => {}).finally(() => { a.inFlight = false; });
  }

  /** Clears every timer; call when the run reaches done or error. A later feed (follow-ups) re-activates its actor. */
  close(): void {
    for (const id of this.actors.keys()) this.end(id);
  }
}
