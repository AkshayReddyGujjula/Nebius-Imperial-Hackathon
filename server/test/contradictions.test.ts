import OpenAI from "openai";
import { Completions } from "openai/resources/chat/completions";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { costUsd } from "@shared/pricing";
import { CONFIG } from "../src/config";
import { auditContradictions } from "../src/checks/contradictions";
import { finding, runContext } from "./helpers/runContext";

vi.mock("../src/config", () => ({ CONFIG: {
  keys: { nebius: "test-key" }, nebiusBaseUrl: "https://example.test/v1/",
  models: { audit: "MiniMaxAI/MiniMax-M3.1-Flash" }, auditEffort: "low", jsonMode: true,
} }));
vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));

const pair = (a = "F1", b = "F2") => ({ a, b, severity: "direct", explanation: "Opposite claims about exam recall." });
const activeFindings = () => [finding("F1", "a1"), finding("F2", "a2")];
const rawUsage = {
  prompt_tokens: 200, completion_tokens: 80, total_tokens: 280,
  prompt_tokens_details: { cached_tokens: 50 }, completion_tokens_details: { reasoning_tokens: 20 },
};

async function* reply(content: string) {
  yield { choices: [{ delta: { reasoning_content: "Checking claims" } }], system_fingerprint: "test-fingerprint" };
  yield { choices: [{ delta: { content }, finish_reason: "stop" }] };
  yield { choices: [], usage: rawUsage };
}

beforeEach(() => {
  CONFIG.auditEffort = "low";
  CONFIG.jsonMode = true;
  vi.mocked(delay).mockClear();
});
afterEach(() => vi.restoreAllMocks());

function respond(content = JSON.stringify({ contradictions: [pair()] })) {
  return vi.spyOn(Completions.prototype, "create").mockResolvedValue(reply(content) as never);
}

describe("contradiction audit", () => {
  it.each([
    { findings: [] },
    { findings: [finding("F1", "a1"), finding("F2", "a1")] },
    { findings: [finding("F1", "a1"), finding("F2", "a2", { stale: true })] },
  ])("skips the API when fewer than two active agents have findings (%#)", async ({ findings }) => {
    const create = respond();
    const { ctx, events } = runContext(findings);
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    expect(events).toEqual([expect.objectContaining({
      type: "contradictions.ready", contradictions: [], usage: null, error: null,
    })]);
  });

  it("calls the configured MiniMax model and emits validated pairs with measured usage", async () => {
    const create = respond();
    const { ctx, events } = runContext(activeFindings());
    await auditContradictions(ctx);

    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({
      model: CONFIG.models.audit, stream: true, max_tokens: 6000, reasoning_effort: "low",
      stream_options: { include_usage: true }, response_format: { type: "json_object" },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(body.messages[1]).toMatchObject({
      role: "user", content: expect.stringContaining('F1 (agent a1 · question: q1): Claim from F1 — quote: "Quote from F1"'),
    });
    expect(ctx.state.contradictions).toEqual([{
      id: "x1", findingIds: ["F1", "F2"], severity: "direct",
      explanation: "Opposite claims about exam recall.", model: CONFIG.models.audit,
    }]);
    expect(ctx.state.usages).toEqual([{ actorId: "auditor", usage: expect.objectContaining({
      model: CONFIG.models.audit, inputTokens: 200, cachedInputTokens: 50,
      outputTokens: 80, reasoningTokens: 20, costUsd: costUsd(CONFIG.models.audit, 200, 50, 80),
      ms: expect.any(Number), ttftMs: expect.any(Number),
    }) }]);
    expect(ctx.state.fingerprint).toBe("test-fingerprint");
    expect(events).toEqual([expect.objectContaining({
      type: "contradictions.ready", contradictions: ctx.state.contradictions,
      usage: ctx.state.usages[0].usage, error: null,
    })]);
  });

  it("rejects missing, stale, same-agent and reversed duplicate pairs", async () => {
    const create = respond(JSON.stringify({ contradictions: [
      pair("F1", "missing"), pair("F1", "F3"), pair("F1", "F4"),
      pair(), pair("F2", "F1"), pair("F2", "F3"),
    ] }));
    const { ctx } = runContext([
      ...activeFindings(), finding("F3", "a1"), finding("F4", "a3", { stale: true }),
    ]);
    await auditContradictions(ctx);
    expect(ctx.state.contradictions.map((c) => c.findingIds)).toEqual([["F1", "F2"], ["F2", "F3"]]);
    expect(ctx.state.counters.contradiction).toBe(2);
    expect(create.mock.calls[0][0].messages[1]).toMatchObject({ content: expect.not.stringContaining("F4") });
  });

  it("keeps at most four unique valid pairs", async () => {
    respond(JSON.stringify({ contradictions: Array.from({ length: 6 }, (_, i) => pair("F1", `F${i + 2}`)) }));
    const { ctx } = runContext(Array.from({ length: 7 }, (_, i) => finding(`F${i + 1}`, `a${i + 1}`)));
    await auditContradictions(ctx);
    expect(ctx.state.contradictions).toHaveLength(4);
    expect(ctx.state.contradictions.map((c) => c.id)).toEqual(["x1", "x2", "x3", "x4"]);
  });

  it("accepts fenced JSON with a trailing comma and safe schema defaults", async () => {
    respond('```json\n{"contradictions":[{"a":"F1","b":"F2","severity":"unknown",},]}\n```');
    const { ctx, events } = runContext(activeFindings());
    await auditContradictions(ctx);
    expect(ctx.state.contradictions[0]).toMatchObject({ severity: "tension", explanation: "" });
    expect(events[0]).toMatchObject({ error: null });
  });

  it.each(["No JSON here", '{"contradictions":"wrong shape"}', '{"contradictions":[{"a":42,"b":"F2"}]}'])
  ("reports unavailable for malformed output: %s", async (content) => {
    respond(content);
    const { ctx, events } = runContext(activeFindings());
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(ctx.state.contradictions).toEqual([]);
    expect(ctx.state.usages).toHaveLength(1);
    expect(events).toEqual([expect.objectContaining({
      type: "contradictions.ready", contradictions: [], usage: null, error: "Audit unavailable",
    })]);
  });

  it("retries a rate limit before streaming, then succeeds", async () => {
    const create = respond();
    create.mockRejectedValueOnce(new OpenAI.APIError(429, {}, "Rate limited", new Headers({ "retry-after": "1" })));
    const { ctx } = runContext(activeFindings());
    await auditContradictions(ctx);
    expect(create).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(expect.any(Number), undefined, { signal: expect.any(AbortSignal) });
    expect(vi.mocked(delay).mock.calls[0][0]).toBeGreaterThanOrEqual(1000);
    expect(ctx.state.contradictions).toHaveLength(1);
  });

  it("stops after two retries on a connection failure", async () => {
    const create = respond().mockRejectedValue(new OpenAI.APIConnectionError({ message: "Offline" }));
    const { ctx, events } = runContext(activeFindings());
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(events[0]).toMatchObject({ error: "Audit unavailable" });
  });

  it("does not retry a non-retryable client error or expose its details", async () => {
    const create = respond().mockRejectedValue(new OpenAI.APIError(401, {}, "Private upstream details", new Headers()));
    const { ctx, events } = runContext(activeFindings());
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(events)).not.toContain("Private upstream details");
    expect(events[0]).toMatchObject({ error: "Audit unavailable" });
  });

  it("does not retry or emit partial contradictions after streaming starts", async () => {
    async function* brokenStream() {
      yield { choices: [{ delta: { content: '{"contradictions":[' } }] };
      throw new OpenAI.APIConnectionError({ message: "Stream interrupted" });
    }
    const create = respond().mockResolvedValue(brokenStream() as never);
    const { ctx, events } = runContext(activeFindings());
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({ contradictions: [], usage: null, error: "Audit unavailable" });
  });

  it("does not throw even if the event sink fails", async () => {
    respond();
    const { ctx } = runContext(activeFindings());
    vi.spyOn(ctx, "emit").mockImplementation(() => { throw new Error("Sink unavailable"); });
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(ctx.state.contradictions).toEqual([]);
  });

  it("does not publish a pair if assigning its id fails", async () => {
    respond();
    const { ctx, events } = runContext(activeFindings());
    vi.spyOn(ctx, "nextId").mockImplementation(() => { throw new Error("ID unavailable"); });
    await expect(auditContradictions(ctx)).resolves.toBeUndefined();
    expect(events[0]).toMatchObject({ contradictions: [], error: "Audit unavailable" });
  });

  it.each(["none", "omit"] as const)("honours the %s effort override", async (effort) => {
    CONFIG.auditEffort = effort;
    const create = respond();
    const { ctx } = runContext(activeFindings());
    await auditContradictions(ctx);
    if (effort === "omit") expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning_effort");
    else expect(create.mock.calls[0][0]).toHaveProperty("reasoning_effort", "none");
  });

  it("honours JSON_MODE=false", async () => {
    CONFIG.jsonMode = false;
    const create = respond();
    const { ctx } = runContext(activeFindings());
    await auditContradictions(ctx);
    expect(create.mock.calls[0][0]).not.toHaveProperty("response_format");
  });
});
