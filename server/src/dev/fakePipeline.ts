// Dev only (FAKE_PIPELINE=1): a scripted ~40 s run that emits every P0 event type and mutates
// run.state the way the real pipeline does. No network calls. Everything it says is labelled FAKE.
import type { AgentInfo, Effort, Finding, Plan, Question, ScoreProposal, Source, Synthesis, Usage } from "@shared/index";
import { canonicalUrl, costUsd, domainOf } from "@shared/index";
import { CONFIG, EFFORT } from "../config";
import { checkFinding } from "../checks/quote";
import type { AgentRuntime, RunContext } from "../runs/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function usage(model: string, inputTokens: number, outputTokens: number, reasoningTokens: number, ms: number): Usage {
  return { model, inputTokens, cachedInputTokens: 0, outputTokens, reasoningTokens, costUsd: costUsd(model, inputTokens, 0, outputTokens), ms, ttftMs: 300 };
}

async function think(run: RunContext, actorId: string, lines: string[], summaries: string[], stepMs: number): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    run.emit({ type: "reasoning.chunk", actorId, text: lines[i] + " " });
    if (i % 2 === 1 && summaries.length) {
      const s = summaries[Math.floor(i / 2) % summaries.length];
      run.emit({ type: "reasoning.summary", actorId, text: s });
      run.recordUsage("summarizer", usage(CONFIG.models.summary, 300, 12, 0, 280));
    }
    await sleep(stepMs);
  }
}

interface FakeSource { url: string; title: string; content: string; date: string | null }
interface FakeFinding { claim: string; quote: string; src: number; optionIds: string[]; criterionIds: string[]; confidence: Finding["confidence"] }
interface FakeBranch {
  question: Omit<Question, "id" | "effort" | "effortRequested" | "parentNodeId" | "origin" | "stale"> & { effort: Effort };
  queries: string[];
  extraQueries: string[];
  sources: FakeSource[];
  findings: FakeFinding[];
  scores: { optionId: string; criterionId: string; score: number; rationale: string; findings: number[] }[];
  answer: string;
  gaps: string[];
  thinking: string[];
  summaries: string[];
}

const BRANCHES: FakeBranch[] = [
  {
    question: { text: "How much does one night of reduced sleep hurt exam performance two days later?", why: "The hackathon runs late the day before the exam.",
      optionIds: ["o1", "o2"], criterionIds: ["c1"], effort: "high", effortReason: "Needs comparing several sleep studies.", seedQueries: [] },
    queries: ["sleep deprivation effect on exam performance next day", "one night short sleep memory recall students"],
    extraQueries: ["recovery sleep after one short night cognitive performance"],
    sources: [
      { url: "https://www.sleepfoundation.org/sleep-deprivation/effects-on-students", title: "How sleep loss affects students (FAKE)", date: "2024-03-11",
        content: "Students who slept fewer than six hours scored on average 8% lower on recall tests the following day. [...] A single night of recovery sleep restored most of the deficit." },
      { url: "https://www.nature.com/articles/fake-sleep-memory", title: "Sleep and memory consolidation (FAKE)", date: "2023-09-02",
        content: "Memory consolidation of material learned before sleep is impaired by partial sleep loss, but effects on previously consolidated material are small." },
    ],
    findings: [
      { claim: "Short sleep the night before cuts next-day recall by about 8%.", quote: "scored on average 8% lower on recall tests the following day", src: 0, optionIds: ["o1"], criterionIds: ["c1"], confidence: "medium" },
      { claim: "A full night of recovery sleep restores most of the deficit.", quote: "A single night of recovery sleep restored most of the deficit", src: 0, optionIds: ["o2"], criterionIds: ["c1"], confidence: "medium" },
    ],
    scores: [{ optionId: "o1", criterionId: "c1", score: 2, rationale: "Late finish risks sleep loss.", findings: [0] },
             { optionId: "o2", criterionId: "c1", score: 4, rationale: "Leaves a full night of sleep.", findings: [1] }],
    answer: "One short night costs some recall, but a full night afterwards recovers most of it (FAKE).",
    gaps: ["No data on 70%-prepared students specifically"],
    thinking: ["The question is about a two-day gap, not the next day.", "Source s1 gives an 8% figure for next-day recall.", "Recovery sleep matters more here.", "So leaving early protects sleep."],
    summaries: ["Weighing sleep loss against recovery time", "Checking how big the recall drop is"],
  },
  {
    question: { text: "How much do hackathons actually help a student's CV and job prospects?", why: "The CV benefit is the main reason to go.",
      optionIds: ["o1", "o2", "o3"], criterionIds: ["c2"], effort: "low", effortReason: "One well-established fact.", seedQueries: [] },
    queries: ["do hackathons help student job applications", "recruiters value hackathon experience"],
    extraQueries: [],
    sources: [
      { url: "https://www.example-careers.com/hackathons-recruiters", title: "What recruiters think of hackathons (FAKE)", date: null,
        content: "62% of surveyed tech recruiters said a hackathon project on a CV made them more likely to interview a graduate." },
    ],
    findings: [
      { claim: "Most tech recruiters see a hackathon project as a plus.", quote: "62% of surveyed tech recruiters said a hackathon project on a CV made them more likely to interview", src: 0, optionIds: ["o1", "o2"], criterionIds: ["c2"], confidence: "high" },
    ],
    scores: [{ optionId: "o1", criterionId: "c2", score: 5, rationale: "Full project to show.", findings: [0] },
             { optionId: "o2", criterionId: "c2", score: 4, rationale: "Still a project, less polish.", findings: [0] },
             { optionId: "o3", criterionId: "c2", score: 1, rationale: "Nothing to show.", findings: [] }],
    answer: "Hackathon projects measurably help interview chances (FAKE).",
    gaps: [],
    thinking: ["The recruiter survey is the key number.", "62% is a strong signal."],
    summaries: ["Checking what recruiters say about hackathons"],
  },
  {
    question: { text: "Does a final day of revision matter much when you are already about 70% prepared?", why: "The exam is worth 40% of the module.",
      optionIds: ["o1", "o2", "o3"], criterionIds: ["c1"], effort: "max", effortReason: "Contested evidence on cramming.", seedQueries: [] },
    queries: ["last day revision effectiveness exam", "spaced practice vs cramming final day", "retrieval practice day before exam"],
    extraQueries: ["how many hours of revision day before exam optimal", "testing effect short session exam scores"],
    sources: [
      { url: "https://www.apa.org/fake/retrieval-practice", title: "Retrieval practice and exam scores (FAKE)", date: "2022-05-20",
        content: "Two hours of practice testing produced larger gains than six hours of re-reading. [...] Gains were largest for students with gaps in otherwise solid knowledge." },
      { url: "https://www.edu-research.org/fake/cramming", title: "Is cramming worth it? (FAKE)", date: "2021-11-01",
        content: "Last-day cramming improved scores mainly for under-prepared students; well-prepared students gained little." },
      { url: "https://www.sleepfoundation.org/sleep-deprivation/effects-on-students", title: "How sleep loss affects students (FAKE)", date: "2024-03-11",
        content: "Students who slept fewer than six hours scored on average 8% lower on recall tests the following day." },
    ],
    findings: [
      { claim: "Two focused hours of practice testing beat a full day of re-reading.", quote: "Two hours of practice testing produced larger gains than six hours of re-reading", src: 0, optionIds: ["o2"], criterionIds: ["c1"], confidence: "high" },
      { claim: "Well-prepared students gain little from last-day cramming.", quote: "well-prepared students gained little", src: 1, optionIds: ["o1", "o2"], criterionIds: ["c1"], confidence: "medium" },
      { claim: "Cramming helps under-prepared students most.", quote: "cramming improved scores mainly for students who were under-prepared", src: 1, optionIds: ["o3"], criterionIds: ["c1"], confidence: "low" },
    ],
    scores: [{ optionId: "o1", criterionId: "c1", score: 3, rationale: "Little revision time, but well prepared.", findings: [1] },
             { optionId: "o2", criterionId: "c1", score: 4, rationale: "Two hours of practice testing is enough.", findings: [0] },
             { optionId: "o3", criterionId: "c1", score: 5, rationale: "Maximum revision.", findings: [2] }],
    answer: "At 70% prepared, a short practice-test session gives most of the benefit of a full day (FAKE).",
    gaps: ["Unknown which topics make up the remaining 30%"],
    thinking: ["Is the user under-prepared or well prepared? 70% is in between.", "Practice testing evidence is strong.", "Cramming evidence is mixed.", "A partial day may capture most of the gain.", "Check sleep source overlap with the other agent.", "Writing up the scores now."],
    summaries: ["Weighing cramming against practice testing", "Comparing gains for well-prepared students", "Checking how much revision time is enough"],
  },
  {
    question: { text: "Can you leave a hackathon early and still get the learning and networking benefits?", why: "A partial-day option may get the best of both.",
      optionIds: ["o2"], criterionIds: ["c2", "c3"], effort: "high", effortReason: "Needs comparing first-hand accounts.", seedQueries: [] },
    queries: ["leaving hackathon early still worth it", "hackathon networking first half of day"],
    extraQueries: ["hackathon team leave early etiquette"],
    sources: [
      { url: "https://www.devpost-blog.example/leaving-early", title: "Leaving a hackathon early (FAKE)", date: "2023-06-14",
        content: "Most networking happens at the opening and lunch; final pitches matter for prizes but less for contacts." },
    ],
    findings: [
      { claim: "Most hackathon networking happens early in the day.", quote: "Most networking happens at the opening and lunch", src: 0, optionIds: ["o2"], criterionIds: ["c3"], confidence: "medium" },
    ],
    scores: [{ optionId: "o2", criterionId: "c3", score: 4, rationale: "Catches the opening and lunch.", findings: [0] },
             { optionId: "o1", criterionId: "c3", score: 5, rationale: "Full day of networking.", findings: [0] }],
    answer: "Leaving mid-afternoon keeps most of the networking value (FAKE).",
    gaps: ["Team may need you for the final pitch"],
    thinking: ["The opening and lunch are where people meet.", "Prizes need the pitch, contacts don't."],
    summaries: ["Checking when hackathon networking happens"],
  },
];

function buildPlan(run: RunContext): Plan {
  const q = (b: FakeBranch): Question => ({
    ...b.question, id: run.nextId("question"), effortRequested: b.question.effort, seedQueries: b.queries,
    parentNodeId: null, origin: "plan", stale: false,
  });
  return {
    version: 1,
    title: "Hackathon or exam prep? (FAKE run)",
    facts: [
      { id: run.nextId("fact"), kind: "constraint", text: "Hackathon runs 10:00–19:00 tomorrow", quote: "from 10 till 7", origin: "user" },
      { id: run.nextId("fact"), kind: "fact", text: "Exam is worth 40% of the module", quote: "worth 40% of the module", origin: "user" },
      { id: run.nextId("fact"), kind: "fact", text: "About 70% prepared", quote: "maybe 70% prepared", origin: "user" },
    ],
    options: [
      { id: "o1", label: "Go full day", description: "Stay at the hackathon until 19:00.", origin: "user" },
      { id: "o2", label: "Go until 15:00", description: "Attend the morning, leave mid-afternoon to revise.", origin: "ai" },
      { id: "o3", label: "Skip it", description: "Spend the whole day revising.", origin: "user" },
    ],
    criteria: [
      { id: "c1", label: "Exam performance", description: "Score on the ML exam.", weight: 8, weightReason: "The exam is 40% of the module." },
      { id: "c2", label: "CV value", description: "A project to show employers.", weight: 6, weightReason: "\"great for my CV\"." },
      { id: "c3", label: "Learning and contacts", description: "Skills and people met.", weight: 4, weightReason: "\"I'd learn a lot\"." },
    ],
    questions: BRANCHES.map(q),
    blindSpot: {
      id: "bs1", kind: "unstated_assumption", text: "Does your team need you there for the final pitch at 18:00?",
      reason: "Leaving early only works if the team doesn't depend on you at the end.", quote: "I'd learn a lot",
      researchable: false, seedQueries: [], status: "open", answer: null, questionId: null,
    },
  };
}

function registerSource(run: RunContext, s: FakeSource): Source {
  const st = run.state;
  const key = canonicalUrl(s.url);
  const existing = st.sourceIdByUrl.get(key);
  if (existing) return st.sources.get(existing)!;
  const src: Source = { id: run.nextId("source"), url: s.url, title: s.title, domain: domainOf(s.url), score: 0.8, publishedDate: s.date, content: s.content };
  st.sources.set(src.id, src);
  st.sourceIdByUrl.set(key, src.id);
  return src;
}

async function fakeSearch(run: RunContext, rt: AgentRuntime, round: number, query: string, sources: FakeSource[], ms: number): Promise<Source[]> {
  const searchId = run.nextId("search");
  run.emit({ type: "search.started", agentId: rt.info.id, searchId, round, query });
  await sleep(ms);
  const regs = sources.map((s) => registerSource(run, s));
  for (const s of regs) rt.shownSourceIds.add(s.id);
  run.state.tavily.searches += 1;
  run.state.tavily.credits += 2;
  run.emit({ type: "search.done", agentId: rt.info.id, searchId, sources: regs.map(({ content: _c, ...ref }) => ref), ms, credits: 2, error: null });
  run.flushStats();
  return regs;
}

async function fakeAgent(run: RunContext, q: Question, b: FakeBranch, startDelay: number, pace: number): Promise<void> {
  await sleep(startDelay);
  const prof = EFFORT[q.effort];
  const info: AgentInfo = { id: run.nextId("agent"), questionId: q.id, effort: q.effort, model: CONFIG.models.agent, extraRounds: prof.extraRounds, startedAt: Date.now() };
  const rt: AgentRuntime = { info, status: "queued", shownSourceIds: new Set(), promptSourcesText: "", findingIds: [], answer: "", gaps: [], startedAt: info.startedAt, endedAt: null, usage: [] };
  run.state.agents.set(info.id, rt);
  run.emit({ type: "agent.spawned", agent: info });
  const status = (s: AgentRuntime["status"], round: number, note: string | null = null) => {
    rt.status = s;
    run.emit({ type: "agent.status", agentId: info.id, status: s, round, sourcesRead: rt.shownSourceIds.size, note });
  };

  // Round 1: seeded searches, run concurrently by code.
  status("searching", 1);
  const half = Math.ceil(b.sources.length / 2);
  const seeded = await Promise.all(b.queries.map((query, i) =>
    fakeSearch(run, rt, 1, query, i === 0 ? b.sources.slice(0, half) : b.sources.slice(half), 1500 + i * 600)));
  rt.promptSourcesText = seeded.flat().map((s) => `[${s.id}] ${s.title}`).join("\n");
  status("reading", 1);
  await sleep(800 * pace);
  status("thinking", 1);
  await think(run, info.id, b.thinking.slice(0, Math.ceil(b.thinking.length / 2)), b.summaries, 700 * pace);
  run.recordUsage(info.id, usage(info.model, 4200, 1600, 1100, 5200 * pace));

  // Extra rounds the model asked for.
  for (let r = 0; r < Math.min(prof.extraRounds, b.extraQueries.length ? prof.extraRounds : 0); r++) {
    status("searching", r + 2, `Round ${r + 2}: looking for more specific evidence`);
    const q2 = b.extraQueries.slice(r * prof.queriesPerRound, (r + 1) * prof.queriesPerRound);
    if (q2.length === 0) break;
    await Promise.all(q2.map((query) => fakeSearch(run, rt, r + 2, query, [], 1100)));
    status("thinking", r + 2);
    await think(run, info.id, b.thinking.slice(Math.ceil(b.thinking.length / 2)), b.summaries.slice(1), 650 * pace);
    run.recordUsage(info.id, usage(info.model, 6800, 2100, 1500, 6100 * pace));
  }

  status("writing", 1 + prof.extraRounds);
  await sleep(900 * pace);
  const allSources = [...run.state.sources.values()];
  const findingIdByIndex: string[] = [];
  for (const f of b.findings) {
    const src = allSources.find((s) => canonicalUrl(s.url) === canonicalUrl(b.sources[f.src].url))!;
    const id = run.nextId("finding");
    const finding: Finding = {
      id, agentId: info.id, questionId: q.id, claim: f.claim, quote: f.quote, sourceId: src.id,
      optionIds: f.optionIds, criterionIds: f.criterionIds, confidence: f.confidence,
      checks: checkFinding(run, info.id, { quote: f.quote, sourceId: src.id }), stale: false,
    };
    run.state.findings.set(id, finding);
    rt.findingIds.push(id);
    findingIdByIndex.push(id);
    run.emit({ type: "finding.added", finding, source: { ...src, content: src.content.slice(0, 4000) } });
    await sleep(350);
  }
  const proposals: ScoreProposal[] = b.scores.map((s) => ({
    optionId: s.optionId, criterionId: s.criterionId, score: s.score, rationale: s.rationale,
    findingIds: s.findings.map((i) => findingIdByIndex[i]).filter(Boolean), agentId: info.id,
  }));
  run.state.proposals.push(...proposals);
  run.emit({ type: "scores.proposed", agentId: info.id, proposals });
  const u = usage(info.model, 5100, 900, 300, 3000 * pace);
  run.recordUsage(info.id, u);
  rt.answer = b.answer;
  rt.gaps = b.gaps;
  rt.status = "done";
  rt.endedAt = Date.now();
  run.emit({ type: "agent.done", agentId: info.id, status: "done", answer: b.answer, gaps: b.gaps, usage: u, error: null });
}

export async function fakePipeline(run: RunContext): Promise<void> {
  const st = run.state;
  run.emit({ type: "run.started", decision: st.decision, inputMode: st.inputMode, replay: false, replayOf: null, models: CONFIG.models });
  run.emit({ type: "run.phase", phase: "planning" });
  run.emit({ type: "notice", level: "info", message: "FAKE_PIPELINE=1 — scripted dev run, no models or searches were called." });
  run.flushStats();

  // Plan (~7 s of orchestrator reasoning).
  await think(run, "orchestrator", [
    "The user is choosing between a hackathon and exam revision.", "Options: full day, partial day, skip.",
    "Criteria: exam performance, CV value, learning.", "Exam weight 40% suggests high weight on c1.",
    "Key unknowns: sleep impact, value of last-day revision.", "Also whether leaving early keeps the benefits.",
    "Assign max effort to the contested revision question.", "Blind spot: the team may depend on them at the pitch.",
  ], ["Mapping the options and criteria", "Weighing which questions need deep research", "Checking for unstated assumptions"], 800);
  const plan = buildPlan(run);
  const planUsage = usage(CONFIG.models.orchestrator, 2600, 5200, 4100, 7000);
  run.recordUsage("orchestrator", planUsage, "fp_fake");
  run.emit({ type: "plan.ready", plan, usage: planUsage });   // emit mirrors state.plan

  // Research: all agents concurrently.
  run.emit({ type: "run.phase", phase: "researching" });
  run.flushStats();
  const pace: Record<Effort, number> = { low: 1.6, high: 2.2, max: 2.8 };
  await Promise.all(plan.questions.map((q, i) => fakeAgent(run, q, BRANCHES[i], i * 250, pace[q.effort])));

  // Checking.
  run.emit({ type: "run.phase", phase: "checking" });
  run.flushStats();
  await sleep(1200);
  const finds = [...st.findings.values()];
  const a = finds.find((f) => f.claim.startsWith("Well-prepared"));
  const b = finds.find((f) => f.claim.startsWith("Cramming helps"));
  if (a && b) {
    st.contradictions = [{ id: run.nextId("contradiction"), findingIds: [a.id, b.id], severity: "tension",
      explanation: "One says last-day revision adds little; the other says it helps — they apply to different preparation levels (FAKE).", model: CONFIG.models.audit }];
  }
  const auditUsage = usage(CONFIG.models.audit, 1800, 220, 0, 900);
  run.recordUsage("auditor", auditUsage);
  run.emit({ type: "contradictions.ready", contradictions: st.contradictions, usage: auditUsage, error: null });

  // Synthesis.
  run.emit({ type: "run.phase", phase: "synthesizing" });
  run.emit({ type: "synthesis.started", version: 1 });
  run.flushStats();
  await think(run, "orchestrator", [
    "c1 carries the most weight.", "Option o2 scores well on all three criteria.", "Sleep evidence favours leaving early.",
    "Practice testing makes a short revision session enough.", "Condition on the team not needing them at the pitch.",
  ], ["Weighing the matrix totals", "Writing the recommendation"], 700);
  const weights = Object.fromEntries(plan.criteria.map((c) => [c.id, c.weight]));
  const fid = (prefix: string) => finds.find((f) => f.claim.startsWith(prefix))?.id;
  const synthesis: Synthesis = {
    version: 1,
    recommendation: "Go to the hackathon until 15:00, then revise and sleep",
    optionId: "o2",
    confidence: "medium",
    summary: "FAKE RUN. A partial day keeps most of the CV and networking value while protecting sleep and a focused practice-test session.",
    conditions: ["If your team needs you for the 18:00 pitch, then agree a hand-over before you leave."],
    reasons: [
      { text: "Two hours of practice testing beats a full day of re-reading.", findingIds: [fid("Two focused")].filter(Boolean) as string[] },
      { text: "A full night of sleep recovers most of the recall loss.", findingIds: [fid("A full night")].filter(Boolean) as string[] },
      { text: "Most networking happens before lunch.", findingIds: [fid("Most hackathon")].filter(Boolean) as string[] },
    ],
    cruxes: ["How much the team depends on you at the end", "Which topics make up your missing 30%"],
    nextSteps: ["Tell your team you're leaving at 15:00", "Plan two hours of past-paper practice for the evening"],
    uncertainties: ["Sources are FAKE fixtures from the dev pipeline"],
    basedOnWeights: weights,
    basedOnFactIds: plan.facts.map((f) => f.id),
    createdAt: Date.now(),
  };
  const synthUsage = usage(CONFIG.models.orchestrator, 9000, 3800, 2900, 5000);
  run.recordUsage("orchestrator", synthUsage);
  run.emit({ type: "synthesis.ready", synthesis, usage: synthUsage });   // emit mirrors state.synthesis

  run.emit({ type: "run.phase", phase: "done" });
  run.flushStats();
}
