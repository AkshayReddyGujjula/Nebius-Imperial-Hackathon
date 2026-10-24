import type { AgentStatus, Finding, Question, ScoreProposal, Usage } from "@shared/index";
import { CONFIG, EFFORT } from "../config";
import { checkFinding } from "../checks/quote";
import { callJson, parseJsonLoose, sumUsage, zodIssues } from "../llm/json";
import { streamChat, type ChatResult, type ToolCall } from "../llm/nebius";
import type { Summarizer } from "../llm/summarizer";
import type { AgentRuntime, RunContext } from "../runs/types";
import { clientSource, formatBlocks, searchAndRegister, type SearchOutcome } from "../tools/tavily";
import { shortMessage } from "./orchestrator";
import {
  FINISH_RULE_JSON, FINISH_RULE_SALVAGE, FINISH_RULE_TOOLS, SEARCH_RULE_NONE, TOOL_SUBMIT, TOOL_TAVILY,
  buildAgentSystem, searchRuleMore, searchRuleStart,
} from "./prompts";
import { JsonActionOut, SubmitOut } from "./schemas";

const emptyUsage = (model: string): Usage => ({
  model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0, ms: 0, ttftMs: null });

export function sumUsages(agent: AgentRuntime): Usage {
  return agent.usage.reduce((a, b) => sumUsage(a, b), emptyUsage(agent.info.model));
}

async function safeSearch(ctx: RunContext, agentId: string, round: number, query: string): Promise<SearchOutcome> {
  try { return await searchAndRegister(ctx, agentId, round, query); }
  catch (err) { return { searchId: "", query, sources: [], ms: 0, credits: 0, error: shortMessage(err) }; }
}

function toolQuery(tc: ToolCall): string | null {
  try {
    const q = (parseJsonLoose(tc.arguments) as any)?.query;
    return typeof q === "string" && q.trim() ? q.trim().slice(0, 300) : null;
  } catch { return null; }
}

/** Runs one research agent for `question`. Never throws: every failure ends in agent.done. */
export async function runAgent(ctx: RunContext, summarizer: Summarizer, question: Question): Promise<void> {
  const state = ctx.state;
  const plan = state.plan!;
  const profile = EFFORT[question.effort];
  const isDeeper = question.seedQueries.length === 0;
  let extraRounds = isDeeper ? Math.max(1, profile.extraRounds) : profile.extraRounds;
  const agentId = ctx.nextId("agent");
  const startedAt = Date.now();
  const agent: AgentRuntime = {
    info: { id: agentId, questionId: question.id, effort: question.effort, model: CONFIG.models.agent, extraRounds, startedAt },
    status: "queued", shownSourceIds: new Set(), promptSourcesText: "", findingIds: [], answer: "", gaps: [],
    startedAt, endedAt: null, usage: [],
  };
  state.agents.set(agentId, agent);
  ctx.emit({ type: "agent.spawned", agent: agent.info });
  const deadline = startedAt + profile.agentTimeoutMs;
  let round = 1;
  const setStatus = (status: AgentStatus, note: string | null = null) => {
    agent.status = status;
    ctx.emit({ type: "agent.status", agentId, status, round, sourcesRead: agent.shownSourceIds.size, note });
  };
  const record = (res: ChatResult) => { agent.usage.push(res.usage); ctx.recordUsage(agentId, res.usage, res.fingerprint); };
  let sourcesText = "";
  const addOutcomes = (outcomes: SearchOutcome[]): string => {
    const text = formatBlocks(outcomes);
    for (const o of outcomes) for (const s of o.sources) agent.shownSourceIds.add(s.id);
    sourcesText = sourcesText ? `${sourcesText}\n\n${text}` : text;
    agent.promptSourcesText = sourcesText;
    return text;
  };

  const finalize = (payload: SubmitOut, status: "done" | "timeout") => {
    setStatus("writing");
    const optionIds = new Set(plan.options.map((o) => o.id));
    const criterionIds = new Set(plan.criteria.map((c) => c.id));
    for (const f of payload.findings.slice(0, 3)) {
      const id = ctx.nextId("finding");
      const sourceId = f.sourceId.trim().replace(/^\[|\]$/g, "");
      const checks = checkFinding(ctx, agentId, { quote: f.quote, sourceId });
      const finding: Finding = {
        id, agentId, questionId: question.id, claim: f.claim, quote: f.quote, sourceId,
        optionIds: f.optionIds.filter((x) => optionIds.has(x)), criterionIds: f.criterionIds.filter((x) => criterionIds.has(x)),
        confidence: f.confidence, checks, stale: false,
      };
      state.findings.set(id, finding);
      agent.findingIds.push(id);
      const src = state.sources.get(sourceId);
      ctx.emit({ type: "finding.added", finding, source: src ? clientSource(src) : null });
    }
    const proposals: ScoreProposal[] = payload.scores
      .filter((s) => optionIds.has(s.optionId) && criterionIds.has(s.criterionId) && Number.isFinite(s.score))
      .map((s) => ({
        optionId: s.optionId, criterionId: s.criterionId, score: Math.max(1, Math.min(5, Math.round(s.score))),
        rationale: s.rationale, findingIds: s.findingNumbers.map((n) => agent.findingIds[n - 1]).filter(Boolean), agentId,
      }));
    state.proposals.push(...proposals);
    if (proposals.length) ctx.emit({ type: "scores.proposed", agentId, proposals });
    agent.answer = payload.answer; agent.gaps = payload.gaps; agent.endedAt = Date.now(); agent.status = status;
    ctx.emit({ type: "agent.done", agentId, status, answer: payload.answer, gaps: payload.gaps, usage: sumUsages(agent), error: null });
    summarizer.end(agentId); ctx.flushStats();
  };

  const fail = (err: unknown) => {
    agent.endedAt = Date.now(); agent.status = "failed";
    ctx.emit({ type: "agent.done", agentId, status: "failed", answer: "", gaps: [], usage: sumUsages(agent), error: shortMessage(err) });
    summarizer.end(agentId); ctx.flushStats();
  };

  try {
    // ── round 1: seeded searches, run by code ──
    const seeds = question.seedQueries.slice(0, profile.seedQueries);
    if (seeds.length) {
      setStatus("searching");
      const outcomes = await Promise.all(seeds.map((q) => safeSearch(ctx, agentId, 1, q)));
      addOutcomes(outcomes);
      if (outcomes.every((o) => o.sources.length === 0)) extraRounds = Math.max(extraRounds, 1);
      setStatus("reading");
    }
    const hasResults = agent.shownSourceIds.size > 0;
    const searchRule = extraRounds === 0 ? SEARCH_RULE_NONE
      : hasResults ? searchRuleMore(extraRounds, profile.queriesPerRound) : searchRuleStart(profile.queriesPerRound);
    const jsonMode = CONFIG.agentMode === "json";
    const messages: any[] = [
      { role: "system", content: buildAgentSystem(plan, question, searchRule, jsonMode ? FINISH_RULE_JSON : FINISH_RULE_TOOLS, ctx.state.memory) },
      { role: "user", content: sourcesText ? `SEARCH RESULTS (round 1)\n\n${sourcesText}` : "No results yet." },
    ];
    let roundsUsed = 0;

    const doSearches = async (queries: string[]): Promise<SearchOutcome[]> => {
      roundsUsed++; round = roundsUsed + 1;
      setStatus("searching");
      const outcomes = await Promise.all(queries.map((q) => safeSearch(ctx, agentId, round, q)));
      addOutcomes(outcomes);
      setStatus("reading");
      return outcomes;
    };

    for (let turn = 1; turn <= extraRounds + 2; turn++) {
      if (Date.now() >= deadline - 1000) break;
      const canSearch = roundsUsed < extraRounds;
      setStatus("thinking");
      let res: ChatResult;
      try {
        res = await streamChat({
          model: CONFIG.models.agent, messages,
          ...(jsonMode ? { jsonObject: true } : { tools: canSearch ? [TOOL_SUBMIT, TOOL_TAVILY] : [TOOL_SUBMIT] }),
          reasoningEffort: profile.reasoningEffort, maxTokens: profile.maxTokens,
          timeoutMs: Math.max(1000, Math.min(profile.turnTimeoutMs, deadline - Date.now())),
          onReasoning: (d) => summarizer.feed(agentId, d),
        });
      } catch { break; }   // timeout / API error → salvage from what we have
      record(res);
      messages.push({
        role: "assistant", content: res.content ?? "", reasoning_content: res.reasoning,
        ...(res.toolCalls.length ? { tool_calls: res.toolCalls.map((tc) => ({ id: tc.id, type: "function",
          function: { name: tc.name, arguments: tc.arguments } })) } : {}),
      });

      if (jsonMode) {
        let action: JsonActionOut | null = null, problem = "";
        try {
          const p = JsonActionOut.safeParse(parseJsonLoose(res.content));
          if (p.success) action = p.data; else problem = zodIssues(p.error);
        } catch (e) { problem = shortMessage(e); }
        if (action?.action === "submit") { finalize(action, "done"); return; }
        if (action?.action === "search" && canSearch) {
          const out = await doSearches(action.queries.map((q) => q.trim().slice(0, 300)).filter(Boolean).slice(0, profile.queriesPerRound));
          messages.push({ role: "user", content: `SEARCH RESULTS (round ${round})\n\n${formatBlocks(out)}` });
          continue;
        }
        messages.push({ role: "user", content: action?.action === "search"
          ? "You cannot search again. Reply now with the submit JSON object."
          : `Invalid reply:\n${problem}\nReply with ONLY the JSON object described in the rules.` });
        continue;
      }

      // ── tools mode ──
      const calls = res.toolCalls;
      const submit = calls.find((c) => c.name === "submit_findings");
      if (submit) {
        let problem = "";
        try {
          const p = SubmitOut.safeParse(parseJsonLoose(submit.arguments));
          if (p.success) { finalize(p.data, "done"); return; }
          problem = zodIssues(p.error);
        } catch (e) { problem = shortMessage(e); }
        for (const tc of calls) messages.push({ role: "tool", tool_call_id: tc.id,
          content: tc === submit ? `Invalid arguments:\n${problem}\nCall submit_findings again.` : "Not executed." });
        continue;
      }
      const searches = calls.filter((c) => c.name === "tavily_search");
      if (searches.length && canSearch) {
        const allowed: { tc: ToolCall; q: string }[] = [];
        for (const tc of searches) {
          const q = toolQuery(tc);
          if (q && allowed.length < profile.queriesPerRound) allowed.push({ tc, q });
        }
        const out = allowed.length ? await doSearches(allowed.map((a) => a.q)) : [];
        for (const tc of calls) {
          const i = allowed.findIndex((a) => a.tc === tc);
          let content: string;
          if (i >= 0) content = formatBlocks([out[i]]);
          else if (tc.name !== "tavily_search") content = "Unknown tool.";
          else if (!toolQuery(tc)) content = "Not executed: missing query.";
          else content = `Not executed: limit of ${profile.queriesPerRound} queries per round.`;
          messages.push({ role: "tool", tool_call_id: tc.id, content });
        }
        if (roundsUsed >= extraRounds) messages.push({ role: "user", content: "You have no searches left. Call submit_findings now." });
        continue;
      }
      if (!calls.length) {
        try {
          const p = SubmitOut.safeParse(parseJsonLoose(res.content));
          if (p.success && p.data.findings.length) { finalize(p.data, "done"); return; }
        } catch { /* fall through */ }
        messages.push({ role: "user", content: "Please call submit_findings now." });
        continue;
      }
      // Search budget exhausted (smoke: turn 2 sometimes searches again) or unknown tools.
      for (const tc of calls) messages.push({ role: "tool", tool_call_id: tc.id,
        content: tc.name === "tavily_search" ? "Not executed: no searches left. Call submit_findings now." : "Unknown tool." });
    }

    // ── salvage: no valid submit within the turn budget, or the deadline passed ──
    setStatus("writing", "Writing up what it found");
    const { data, result } = await callJson(ctx, agentId, SubmitOut, {
      model: CONFIG.models.agent, reasoningEffort: "low", maxTokens: 6000, timeoutMs: 40_000,
      messages: [
        { role: "system", content: buildAgentSystem(plan, question, SEARCH_RULE_NONE, FINISH_RULE_SALVAGE, ctx.state.memory) },
        { role: "user", content: `SEARCH RESULTS\n\n${sourcesText || "(no results)"}` },
      ],
    });
    agent.usage.push(result.usage);   // callJson already recorded it on the run
    finalize(data, Date.now() > deadline ? "timeout" : "done");
  } catch (err) {
    fail(err);
  }
}
