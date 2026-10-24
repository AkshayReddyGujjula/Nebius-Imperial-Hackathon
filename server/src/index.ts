import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type {
  BlindSpotAnswerRequest, ClarifyRequest, ClarifyResponse, CreateReplayRequest, CreateRunRequest, CreateRunResponse, DeeperRequest, DeeperResponse,
  FollowupRequest, HealthResponse, LadderRequest, LadderResponse, SynthesizeRequest, TranscribeResponse,
} from "@shared/api";
import { CONFIG } from "./config";
import { createRun, getRun, listReplays, resolveReplayFile, startReplay, type Run } from "./runs/runManager";
import type { RunContext } from "./runs/types";
import { runPipeline } from "./pipeline/runPipeline";
import { answerBlindSpot, applyFollowup, digDeeper, researchBlindSpot, resynthesize, runLadder, UserFacingError } from "./pipeline/followups";
import { transcribe } from "./stt/elevenlabs";
import { fakePipeline } from "./dev/fakePipeline";
import { clarify } from "./pipeline/clarify";

const app = new Hono();

if (CONFIG.corsOrigin) app.use("/api/*", cors({ origin: CONFIG.corsOrigin }));

const errMsg = (err: unknown) => String((err as Error)?.message ?? err);
const fail = (c: Context, status: 400 | 404 | 409 | 500 | 502, error: string) => c.json({ error }, status);

async function readJson<T>(c: Context): Promise<Partial<T>> {
  try { return ((await c.req.json()) ?? {}) as Partial<T>; } catch { return {}; }
}

/** Common guard for mutating routes on an existing run: 404 / replay 409 / planning 409. */
function mutableRun(c: Context): { run: Run } | { res: Response } {
  const run = getRun(c.req.param("id") ?? "");
  if (!run) return { res: fail(c, 404, "Run not found") };
  if (run.state.replay) return { res: fail(c, 409, "This is a replay. Start a live run to interact.") };
  if (run.state.phase === "planning" || !run.state.plan) return { res: fail(c, 409, "Wait for the plan to finish.") };
  return { run };
}

/** Fire-and-forget background work; failures surface as a non-fatal run.error. */
function background(run: RunContext, p: Promise<unknown>): void {
  p.catch((err) => run.emit({ type: "run.error", message: errMsg(err), fatal: false }));
}

// ── P0 ──

app.get("/api/health", (c) => {
  const body: HealthResponse = {
    ok: true,
    keys: { nebius: !!CONFIG.keys.nebius, tavily: !!CONFIG.keys.tavily, elevenlabs: !!CONFIG.keys.elevenlabs },
    models: CONFIG.models,
    agentMode: CONFIG.agentMode,
    jsonMode: CONFIG.jsonMode,
  };
  return c.json(body);
});

app.post("/api/clarify", async (c) => {
  const body = await readJson<ClarifyRequest>(c);
  const decision = typeof body.decision === "string" ? body.decision.trim() : "";
  if (decision.length < 10 || decision.length > 4000) return fail(c, 400, "Describe your decision in 10–4000 characters.");
  try {
    const res: ClarifyResponse = await clarify(decision);
    return c.json(res);
  } catch (err) {
    console.warn("[clarify] failed:", err);
    return fail(c, 502, "Couldn't prepare questions. " + errMsg(err));
  }
});

app.post("/api/runs", async (c) => {
  const body = await readJson<CreateRunRequest>(c);
  const decision = typeof body.decision === "string" ? body.decision.trim() : "";
  if (decision.length < 10 || decision.length > 4000) return fail(c, 400, "Describe your decision in 10–4000 characters.");
  const inputMode = body.inputMode === "voice" ? "voice" : "text";
  const run = createRun(decision, inputMode);
  const pipeline = process.env.FAKE_PIPELINE === "1" ? fakePipeline : runPipeline;
  pipeline(run).catch((err) => {
    run.emit({ type: "run.error", message: errMsg(err), fatal: true });
    if (run.state.phase !== "error") run.emit({ type: "run.phase", phase: "error" });
  });
  const res: CreateRunResponse = { runId: run.id };
  return c.json(res);
});

app.get("/api/runs/:id/events", (c) => {
  const run = getRun(c.req.param("id"));
  if (!run) return fail(c, 404, "Run not found");
  const after = Number(c.req.header("Last-Event-ID") ?? c.req.query("after") ?? 0) || 0;
  c.header("Cache-Control", "no-cache");
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    let aborted = false;
    stream.onAbort(() => { aborted = true; });
    let cursor = Math.min(run.log.length, Math.max(0, after));
    while (!aborted) {
      while (cursor < run.log.length && !aborted) {
        const e = run.log[cursor];                       // log[i].seq === i + 1
        await stream.writeSSE({ id: String(e.seq), data: JSON.stringify(e) });
        cursor = e.seq;
      }
      const got = await run.waitForNext(cursor, 15_000);
      if (!got && !aborted) await stream.writeSSE({ event: "ping", data: "{}" });
    }
  });
});

app.get("/api/runs/:id/export", (c) => {
  const run = getRun(c.req.param("id"));
  if (!run) return fail(c, 404, "Run not found");
  // DECISION: serialised from the in-memory log (identical to the JSONL file; also works for replay runs, which aren't written to disk).
  return c.body(run.toJsonl(), 200, {
    "Content-Type": "application/x-ndjson",
    "Content-Disposition": `attachment; filename="${run.id}.jsonl"`,
  });
});

app.post("/api/runs/:id/blindspot/dismiss", (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const bs = g.run.state.plan?.blindSpot;
  if (!bs) return fail(c, 404, "This run has no blind spot.");
  bs.status = "dismissed";
  g.run.emit({ type: "blindspot.updated", blindSpot: { ...bs } });
  return c.json({ ok: true });
});

app.get("/api/replays", async (c) => c.json(await listReplays()));

app.post("/api/replays", async (c) => {
  const body = await readJson<CreateReplayRequest>(c);
  const file = typeof body.file === "string" ? body.file : "";
  if (!resolveReplayFile(file)) return fail(c, 404, "Replay not found");
  try {
    const run = await startReplay(file, typeof body.speed === "number" ? body.speed : 1);
    const res: CreateRunResponse = { runId: run.id };
    return c.json(res);
  } catch (err) {
    return fail(c, 400, errMsg(err));
  }
});

// ── P1 (handlers live in pipeline/followups.ts, checks/contradictions.ts, stt/elevenlabs.ts) ──

app.post("/api/runs/:id/deeper", async (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const body = await readJson<DeeperRequest>(c);
  if (typeof body.nodeId !== "string" || !/^(q|f):/.test(body.nodeId)) return fail(c, 400, "nodeId must be a question or finding node.");
  try {
    const res: DeeperResponse = await digDeeper(g.run, body.nodeId);
    return c.json(res);
  } catch (err) {
    return fail(c, err instanceof UserFacingError ? 409 : 500, errMsg(err));
  }
});

app.post("/api/runs/:id/blindspot/research", async (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const bs = g.run.state.plan?.blindSpot;
  if (!bs || !bs.researchable || bs.status !== "open") return fail(c, 409, "This blind spot can't be researched.");
  try {
    return c.json(await researchBlindSpot(g.run));
  } catch (err) {
    return fail(c, err instanceof UserFacingError ? 409 : 500, errMsg(err));
  }
});

app.post("/api/runs/:id/blindspot/answer", async (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const body = await readJson<BlindSpotAnswerRequest>(c);
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!answer) return fail(c, 400, "Answer is empty.");
  if (!g.run.state.plan?.blindSpot) return fail(c, 404, "This run has no blind spot.");
  try {
    await answerBlindSpot(g.run, answer);
    return c.json({ ok: true });
  } catch (err) {
    return fail(c, err instanceof UserFacingError ? 409 : 500, errMsg(err));
  }
});

app.post("/api/runs/:id/synthesize", async (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  if (g.run.synthesizing || g.run.state.phase === "synthesizing") return fail(c, 409, "A recommendation is already being written.");
  const body = await readJson<SynthesizeRequest>(c);
  const weights: Record<string, number> = {};
  if (body.weights && typeof body.weights === "object") {
    for (const [k, v] of Object.entries(body.weights)) if (typeof v === "number" && Number.isFinite(v)) weights[k] = v;
  }
  background(g.run, resynthesize(g.run, weights));
  return c.json({ ok: true });
});

app.post("/api/runs/:id/ladder", async (c) => {
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const body = await readJson<LadderRequest>(c);
  if (typeof body.questionId !== "string" || !body.questionId) return fail(c, 400, "questionId is required.");
  try {
    const res: LadderResponse = await runLadder(g.run, body.questionId);
    return c.json(res);
  } catch (err) {
    return fail(c, err instanceof UserFacingError ? 409 : 500, errMsg(err));
  }
});

app.post("/api/runs/:id/followup", async (c) => {   // P2
  const g = mutableRun(c);
  if ("res" in g) return g.res;
  const body = await readJson<FollowupRequest>(c);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail(c, 400, "Follow-up is empty.");
  background(g.run, applyFollowup(g.run, text));
  return c.json({ ok: true });
});

app.post("/api/transcribe", async (c) => {
  let audio: unknown;
  try {
    audio = (await c.req.parseBody())["audio"];
  } catch {
    return fail(c, 400, "Expected multipart/form-data with an 'audio' field.");
  }
  if (!(audio instanceof Blob)) return fail(c, 400, "Missing 'audio' file.");
  if (audio.size === 0) return fail(c, 400, "Audio is empty.");
  if (audio.size > 10 * 1024 * 1024) return fail(c, 400, "Audio is larger than 10 MB.");
  try {
    const { text, ms } = await transcribe(audio);
    const res: TranscribeResponse = { text, ms, provider: "elevenlabs" };
    return c.json(res);
  } catch (err) {
    return fail(c, 502, errMsg(err));
  }
});

app.all("/api/*", (c) => fail(c, 404, "Not found"));

// ── production static serving (web/dist) with SPA fallback ──
if (existsSync(CONFIG.webDist)) {
  const root = relative(process.cwd(), CONFIG.webDist).replace(/\\/g, "/") || ".";
  const indexPath = join(CONFIG.webDist, "index.html");
  app.use("*", serveStatic({ root }));
  app.get("*", (c) => (existsSync(indexPath) ? c.html(readFileSync(indexPath, "utf8")) : c.notFound()));
}

serve({ fetch: app.fetch, port: CONFIG.port });
console.log(`Decision Lab server on :${CONFIG.port}${process.env.FAKE_PIPELINE === "1" ? " (FAKE_PIPELINE)" : ""}`);
