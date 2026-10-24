import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { nanoid } from "nanoid";
import type { CruxEvent, CruxEventBody, ReplayInfo, Usage } from "@shared/index";
import { CONFIG } from "../config";
import { computeStats } from "../checks/stats";
import type { AgentRuntime, CounterKind, RunContext, RunState } from "./types";

const ID_PREFIX: Record<CounterKind, string> = {
  question: "q", agent: "a", finding: "F", source: "s", fact: "f", contradiction: "x", search: "srch", ladder: "L",
};
const STATS_THROTTLE_MS = 1000;
const REPLAY_GAP_CAP_MS = 2000;

function freshState(id: string, decision: string, inputMode: "text" | "voice", replay: boolean): RunState {
  return {
    id, decision, inputMode, replay,
    createdAt: Date.now(),
    phase: "planning",
    plan: null,
    agents: new Map(),
    sources: new Map(),
    sourceIdByUrl: new Map(),
    findings: new Map(),
    proposals: [],
    contradictions: [],
    synthesis: null,
    usages: [],
    tavily: { searches: 0, credits: 0 },
    jsonRepairs: 0,
    fingerprint: null,
    counters: { question: 0, agent: 0, finding: 0, source: 0, fact: 0, contradiction: 0, search: 0, ladder: 0 },
  };
}

export class Run implements RunContext {
  readonly id: string;
  readonly state: RunState;
  readonly log: CruxEvent[] = [];
  /** True between synthesis.started and synthesis.ready/failed (the 409 rule on /synthesize). */
  synthesizing = false;
  /** Epoch ms of the first `run.phase done` — freezes wallMs. */
  doneAt: number | null = null;

  private stream: WriteStream | null;
  private waiters: (() => void)[] = [];
  private statsTimer: NodeJS.Timeout | null = null;
  private lastStatsAt = 0;

  constructor(id: string, decision: string, inputMode: "text" | "voice", opts: { replay: boolean; persist: boolean }) {
    this.id = id;
    this.state = freshState(id, decision, inputMode, opts.replay);
    if (opts.persist) {
      mkdirSync(CONFIG.runsDir, { recursive: true });
      this.stream = createWriteStream(join(CONFIG.runsDir, `${id}.jsonl`), { flags: "a" });
      this.stream.on("error", (err) => console.error(`[run ${id}] log write failed:`, err.message));
    } else {
      this.stream = null;
    }
  }

  emit(body: CruxEventBody): CruxEvent {
    const e = { ...body, seq: this.log.length + 1, ts: Date.now(), runId: this.id } as CruxEvent;
    this.log.push(e);
    this.stream?.write(JSON.stringify(e) + "\n");
    this.mirror(e);
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
    return e;
  }

  /** State implied by an event. Live runs: phase/plan/synthesis only (the pipeline mutates the rest). */
  private mirror(e: CruxEvent): void {
    const st = this.state;
    switch (e.type) {
      case "run.phase":
        st.phase = e.phase;
        if (e.phase === "done" && this.doneAt == null) this.doneAt = e.ts;
        break;
      case "plan.ready": case "plan.updated": st.plan = e.plan; break;
      case "synthesis.started": this.synthesizing = true; break;
      case "synthesis.ready": st.synthesis = e.synthesis; this.synthesizing = false; break;
      case "synthesis.failed": this.synthesizing = false; break;
      case "blindspot.updated": if (st.plan) st.plan.blindSpot = e.blindSpot; break;
    }
    if (st.replay) this.mirrorReplay(e);
  }

  /** Replays have no pipeline, so mirror the rest of the state too (keeps a replay's state consistent). */
  private mirrorReplay(e: CruxEvent): void {
    const st = this.state;
    switch (e.type) {
      case "question.added":
        if (st.plan && !st.plan.questions.some((q) => q.id === e.question.id)) st.plan.questions.push(e.question);
        break;
      case "fact.added":
        if (st.plan && !st.plan.facts.some((f) => f.id === e.fact.id)) st.plan.facts.push(e.fact);
        break;
      case "agent.spawned": {
        const rt: AgentRuntime = {
          info: e.agent, status: "queued", shownSourceIds: new Set(), promptSourcesText: "", findingIds: [],
          answer: "", gaps: [], startedAt: e.agent.startedAt, endedAt: null, usage: [],
        };
        st.agents.set(e.agent.id, rt);
        break;
      }
      case "agent.status": { const a = st.agents.get(e.agentId); if (a) a.status = e.status; break; }
      case "agent.done": {
        const a = st.agents.get(e.agentId);
        if (a) { a.status = e.status; a.answer = e.answer; a.gaps = e.gaps; a.endedAt = e.ts; }
        break;
      }
      case "finding.added":
        st.findings.set(e.finding.id, e.finding);
        st.agents.get(e.finding.agentId)?.findingIds.push(e.finding.id);
        if (e.source) st.sources.set(e.source.id, e.source);
        break;
      case "scores.proposed": st.proposals.push(...e.proposals); break;
      case "contradictions.ready": st.contradictions = e.contradictions; break;
    }
  }

  nextId(kind: CounterKind): string {
    this.state.counters[kind] += 1;
    return `${ID_PREFIX[kind]}${this.state.counters[kind]}`;
  }

  recordUsage(actorId: string, usage: Usage, fingerprint?: string | null): void {
    this.state.usages.push({ actorId, usage });
    this.state.agents.get(actorId)?.usage.push(usage);
    if (fingerprint) this.state.fingerprint = fingerprint;
    this.scheduleStats();
  }

  private scheduleStats(): void {
    if (this.statsTimer) return;   // a trailing flush is already pending
    const wait = Math.max(0, this.lastStatsAt + STATS_THROTTLE_MS - Date.now());
    this.statsTimer = setTimeout(() => { this.statsTimer = null; this.flushStats(); }, wait);
  }

  flushStats(): void {
    if (this.statsTimer) { clearTimeout(this.statsTimer); this.statsTimer = null; }
    this.lastStatsAt = Date.now();
    this.emit({ type: "stats.updated", stats: computeStats(this.state, this.doneAt) });
  }

  /** Resolves true as soon as log.length > afterSeq, false on timeout. */
  waitForNext(afterSeq: number, timeoutMs: number): Promise<boolean> {
    if (this.log.length > afterSeq) return Promise.resolve(true);
    return new Promise((resolve) => {
      let done = false;
      const waiter = () => { if (done) return; done = true; clearTimeout(t); resolve(true); };
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(this.log.length > afterSeq);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  toJsonl(): string {
    return this.log.map((e) => JSON.stringify(e)).join("\n") + (this.log.length ? "\n" : "");
  }
}

const runs = new Map<string, Run>();

export function createRun(decision: string, inputMode: "text" | "voice"): Run {
  const run = new Run(`r_${nanoid(8)}`, decision, inputMode, { replay: false, persist: true });
  runs.set(run.id, run);
  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

// ── replays ──

function parseLine(line: string | undefined): CruxEvent | null {
  if (!line) return null;
  try { return JSON.parse(line) as CruxEvent; } catch { return null; }
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

/** DECISION: reads the whole file and takes the first/last lines (files are a few MB at most; simpler than seeking). */
async function replayInfo(dir: string, file: string): Promise<ReplayInfo | null> {
  try {
    const lines = splitLines(await readFile(join(dir, file), "utf8"));
    const first = parseLine(lines[0]);
    const last = parseLine(lines[lines.length - 1]);
    if (!first || !last) return null;
    const started = first.type === "run.started" ? first : lines.map(parseLine).find((e) => e?.type === "run.started");
    const decision = started?.type === "run.started" ? started.decision : "";
    return {
      file, decision,
      recordedAt: new Date(first.ts).toISOString(),
      events: lines.length,
      durationMs: Math.max(0, last.ts - first.ts),
    };
  } catch {
    return null;
  }
}

export async function listReplays(): Promise<ReplayInfo[]> {
  const out: ReplayInfo[] = [];
  const seen = new Set<string>();
  for (const dir of [CONFIG.replaysDir, CONFIG.runsDir]) {
    if (!existsSync(dir)) continue;
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".jsonl") || seen.has(file)) continue;
      const st = await stat(join(dir, file)).catch(() => null);
      if (!st?.isFile() || st.size === 0) continue;
      const info = await replayInfo(dir, file);
      if (info) { out.push(info); seen.add(file); }
    }
  }
  return out.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/** Finds a replay file by bare file name in replaysDir, then runsDir. Rejects paths. */
export function resolveReplayFile(file: string): string | null {
  if (!file || basename(file) !== file || !file.endsWith(".jsonl")) return null;
  for (const dir of [CONFIG.replaysDir, CONFIG.runsDir]) {
    const p = join(dir, file);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Throws if the file is missing or empty. Re-emits recorded events with gaps / speed, each gap capped at 2 s. */
export async function startReplay(file: string, speed = 1): Promise<Run> {
  const path = resolveReplayFile(file);
  if (!path) throw new Error(`Replay not found: ${file}`);
  const events = splitLines(await readFile(path, "utf8")).map(parseLine).filter((e): e is CruxEvent => e !== null);
  if (events.length === 0) throw new Error(`Replay is empty: ${file}`);
  const started = events.find((e) => e.type === "run.started");
  const decision = started?.type === "run.started" ? started.decision : "";
  const inputMode = started?.type === "run.started" ? started.inputMode : "text";
  const originalRunId = events[0].runId;

  const run = new Run(`rp_${nanoid(6)}`, decision, inputMode, { replay: true, persist: false });
  runs.set(run.id, run);

  const sp = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const strip = (e: CruxEvent): CruxEventBody => {
    const { seq: _s, ts: _t, runId: _r, ...body } = e;
    return body as CruxEventBody;
  };

  void (async () => {
    for (let i = 0; i < events.length; i++) {
      if (i > 0) {
        const gap = Math.min(REPLAY_GAP_CAP_MS, Math.max(0, (events[i].ts - events[i - 1].ts) / sp));
        if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      }
      let body = strip(events[i]);
      if (i === 0) {
        body = body.type === "run.started"
          ? { ...body, replay: true, replayOf: originalRunId }
          : { type: "run.started", decision, inputMode, replay: true, replayOf: originalRunId,
              models: started?.type === "run.started" ? started.models : CONFIG.models };
        if (events[i].type !== "run.started") { run.emit(body); body = strip(events[i]); }
      } else if (body.type === "run.started") {
        continue;   // already rewritten as the first event
      }
      run.emit(body);
    }
  })().catch((err) => console.error(`[replay ${run.id}] failed:`, err));

  return run;
}
