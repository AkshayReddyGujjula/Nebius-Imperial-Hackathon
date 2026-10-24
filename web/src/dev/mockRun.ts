// Synthetic event script for `?mock=1` (fixture text — never presented as live; the top bar shows "Mock data").
import type {
  AgentStatus, CruxEvent, CruxEventBody, Effort, Finding, Plan, QuoteCheck, RunStats, ScoreProposal, Source, SourceRef, Usage,
} from '@shared/index'
import type { CruxStore } from '@/store/types'

export const MOCK_RUN_ID = 'mock-run'
const BASE_TS = 1_761_300_000_000

const M = {
  orchestrator: 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
  agent: 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
  summary: 'nvidia/Nemotron-3_5-Lightning',
  audit: 'MiniMaxAI/MiniMax-M3.1-Flash',
}

export const MOCK_DECISION =
  "I've got a hackathon tomorrow from 10 till 7, and my machine learning exam is the day after. The exam is worth 40% of the module and I'm maybe 70% prepared. The hackathon would be great for my CV and I'd learn a lot, but I really don't want to tank the exam. Should I go?"

const usage = (model: string, ms: number, input: number, output: number, reasoning: number, cost: number): Usage =>
  ({ model, inputTokens: input, cachedInputTokens: Math.round(input * 0.3), outputTokens: output, reasoningTokens: reasoning, costUsd: cost, ms, ttftMs: 420 })

// ---------- plan ----------

const PLAN: Plan = {
  version: 1,
  title: 'Hackathon tomorrow vs ML exam the day after',
  facts: [
    { id: 'f1', kind: 'constraint', text: 'Hackathon runs 10:00–19:00 tomorrow', quote: 'a hackathon tomorrow from 10 till 7', origin: 'user' },
    { id: 'f2', kind: 'fact', text: 'Exam is worth 40% of the module', quote: 'The exam is worth 40% of the module', origin: 'user' },
    { id: 'f3', kind: 'fact', text: 'About 70% prepared for the exam', quote: "I'm maybe 70% prepared", origin: 'user' },
    { id: 'f4', kind: 'priority', text: 'Values CV and learning from the hackathon', quote: "The hackathon would be great for my CV and I'd learn a lot", origin: 'user' },
    { id: 'f5', kind: 'feeling', text: 'Worried about tanking the exam', quote: "I really don't want to tank the exam", origin: 'user' },
  ],
  options: [
    { id: 'o1', label: 'Skip the hackathon', description: 'Spend tomorrow revising full-time and rest before the exam.', origin: 'ai' },
    { id: 'o2', label: 'Go for the full day', description: 'Attend 10:00–19:00, revise lightly in the evening.', origin: 'user' },
    { id: 'o3', label: 'Go until 15:00', description: 'Attend the morning and early afternoon, leave to revise and sleep early.', origin: 'ai' },
  ],
  criteria: [
    { id: 'c1', label: 'Exam performance', description: 'Expected exam score given remaining prep.', weight: 9, weightReason: 'You said you really don’t want to tank the exam, and it is worth 40%.' },
    { id: 'c2', label: 'CV value', description: 'How much the day strengthens your CV.', weight: 6, weightReason: 'You mentioned the CV explicitly.' },
    { id: 'c3', label: 'Learning', description: 'Skills and knowledge gained.', weight: 5, weightReason: 'You said you would learn a lot.' },
    { id: 'c4', label: 'Rest and wellbeing', description: 'Sleep and stress going into the exam.', weight: 7, weightReason: 'Sleep the night before strongly affects recall.' },
    { id: 'c5', label: 'Networking', description: 'Contacts with sponsors and other builders.', weight: 3, weightReason: 'Not mentioned; inferred as a minor hackathon benefit.' },
  ],
  questions: [
    { id: 'q1', text: 'How much does one extra day of revision raise exam scores at 70% preparedness?', why: 'Decides how much exam performance you give up by going.',
      optionIds: ['o1', 'o2', 'o3'], criterionIds: ['c1'], effort: 'high', effortRequested: 'high', effortReason: 'Core trade-off; evidence is mixed',
      seedQueries: ['spaced revision final day exam score effect', 'last day cramming vs rest exam performance'], parentNodeId: null, origin: 'plan', stale: false },
    { id: 'q2', text: 'How much do hackathons help a student CV with recruiters?', why: 'Sizes the CV benefit of going.',
      optionIds: ['o2', 'o3'], criterionIds: ['c2', 'c5'], effort: 'low', effortRequested: 'low', effortReason: 'Well-covered topic; quick check',
      seedQueries: ['do recruiters value hackathons student CV'], parentNodeId: null, origin: 'plan', stale: false },
    { id: 'q3', text: 'How does a long, intense day affect sleep and recall two days later?', why: 'Rest before the exam may matter more than the extra hours.',
      optionIds: ['o1', 'o2', 'o3'], criterionIds: ['c1', 'c4'], effort: 'high', effortRequested: 'max', effortReason: 'Capped from max: concurrency limit for this run',
      seedQueries: ['sleep deprivation memory consolidation exam', 'mental fatigue next day cognitive performance'], parentNodeId: null, origin: 'plan', stale: false },
    { id: 'q4', text: 'Do people get most of a hackathon’s value from a partial day?', why: 'Tests whether leaving at 15:00 keeps most of the upside.',
      optionIds: ['o2', 'o3'], criterionIds: ['c2', 'c3', 'c5'], effort: 'low', effortRequested: 'low', effortReason: 'Narrow question; anecdotal evidence',
      seedQueries: ['leave hackathon early still worth it', 'hackathon learning outcomes part-time participation'], parentNodeId: null, origin: 'plan', stale: false },
  ],
  blindSpot: {
    id: 'bs1', kind: 'personal_unknown', text: 'Could you be on a team that’s fine with you leaving early, or would they rely on you until the end?',
    reason: 'Leaving at 15:00 only works if your team agrees; that depends on people only you know.', quote: 'Should I go?',
    researchable: false, seedQueries: [], status: 'open', answer: null, questionId: null,
  },
}

// ---------- sources ----------

const src = (id: string, url: string, title: string, score: number, content: string, publishedDate: string | null = null): Source => ({
  id, url, title, domain: new URL(url).hostname.replace(/^www\./, ''), score, publishedDate, content,
})
const ref = ({ content: _c, ...r }: Source): SourceRef => r

const S: Record<string, Source> = {
  s1: src('s1', 'https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques', 'Improving Students’ Learning With Effective Learning Techniques', 0.91,
    'Distributed practice and practice testing were rated as having high utility. Students who spaced their study sessions retained substantially more material than those who massed study into a single session immediately before the test.', '2013-01-08'),
  s2: src('s2', 'https://www.nature.com/articles/s41539-019-0048-y', 'Sleep and exam performance in university students', 0.88,
    'Students who obtained more sleep in the week and the night before an exam tended to perform better. Sleep quality and duration together accounted for nearly a quarter of the variance in grades.', '2019-10-01'),
  s3: src('s3', 'https://www.sciencedirect.com/science/article/pii/S0001691818301306', 'Cramming and long-term retention', 0.74,
    'Massed study the day before produced good short-term recall but faster forgetting; for a test two days later, the advantage of an extra massed day was small relative to prior spaced study.', '2018-05-14'),
  s4: src('s4', 'https://www.hackerrank.com/research/developer-skills/2023', 'Developer Skills Report 2023', 0.81,
    'Hiring managers listed projects and hackathon experience among the top signals for entry-level candidates, behind internships but ahead of GPA for many technical roles.', '2023-03-01'),
  s5: src('s5', 'https://www.mlh.io/blog/hackathons-and-hiring', 'How hackathons help you get hired', 0.69,
    'Many sponsors use hackathons for recruiting. Participants report interviews from conversations at sponsor booths, typically during the opening and lunch hours.', '2022-09-20'),
  s6: src('s6', 'https://www.sleepfoundation.org/sleep-deprivation/memory', 'How Sleep Affects Memory', 0.86,
    'Sleep plays a critical role in memory consolidation. A night of poor sleep can reduce the ability to form new memories by up to 40 percent.', '2024-01-10'),
  s7: src('s7', 'https://pubmed.ncbi.nlm.nih.gov/28556372/', 'Mental fatigue impairs cognitive performance the next day', 0.72,
    'Prolonged demanding cognitive activity produced subjective fatigue, but performance on recall tasks after a full night of sleep had largely recovered.', '2017-06-01'),
  s8: src('s8', 'https://www.frontiersin.org/articles/10.3389/fpsyg.2020.01245', 'Breaks, novelty and subsequent learning', 0.63,
    'A short engaging break from study did not harm, and in some participants modestly improved, subsequent retention compared with uninterrupted study.', '2020-06-12'),
  s9: src('s9', 'https://devpost.com/blog/first-hackathon-tips', 'Getting the most out of your first hackathon', 0.67,
    'Most of the team formation, workshops and mentor time happens in the first half of the event. The final hours are mostly polishing and judging.', '2021-11-02'),
  s10: src('s10', 'https://www.reddit.com/r/cscareerquestions/comments/hackathon_left_early', 'Left a hackathon early — worth it?', 0.55,
    'I left at 3pm for an exam the next day. My team still submitted and I got most of the networking; I missed judging but did not regret it.', null),
}

// ---------- builder ----------

type Timed = { t: number; body: CruxEventBody }
const out: Timed[] = []
const at = (t: number, body: CruxEventBody) => { out.push({ t, body }) }

const finding = (
  id: string, agentId: string, questionId: string, claim: string, quote: string, sourceId: string,
  optionIds: string[], criterionIds: string[], confidence: Finding['confidence'],
  check: { quote?: QuoteCheck; ratio?: number; retrieved?: boolean } = {},
): Finding => {
  const quoteCheck = check.quote ?? 'verified'
  const retrieved = check.retrieved ?? true
  return {
    id, agentId, questionId, claim, quote, sourceId, optionIds, criterionIds, confidence, stale: false,
    checks: { sourceRetrieved: retrieved, quote: quoteCheck, quoteMatchRatio: check.ratio ?? 1,
      supported: retrieved && (quoteCheck === 'verified' || quoteCheck === 'partial') },
  }
}

const prop = (agentId: string, o: string, c: string, score: number, rationale: string, findingIds: string[]): ScoreProposal =>
  ({ optionId: o, criterionId: c, score, rationale, findingIds, agentId })

interface AgentScript {
  id: string; questionId: string; effort: Effort; extraRounds: number; start: number; end: number;
  summaries: string[];
  searches: { at: number; query: string; sources: string[]; ms: number; error?: string }[];
  findings: { at: number; f: Finding }[];
  proposals: ScoreProposal[];
  answer: string; gaps: string[]; usage: Usage;
}

function playAgent(a: AgentScript) {
  at(a.start - 0.4, { type: 'agent.spawned', agent: { id: a.id, questionId: a.questionId, effort: a.effort, model: M.agent, extraRounds: a.extraRounds, startedAt: BASE_TS + Math.round(a.start * 1000) } })
  const span = a.end - a.start
  a.summaries.forEach((text, i) => {
    const t = a.start + 1 + (span - 3) * (i / Math.max(1, a.summaries.length - 1))
    at(t - 0.3, { type: 'reasoning.chunk', actorId: a.id, text: `${text.toLowerCase()} … ` })
    at(t, { type: 'reasoning.summary', actorId: a.id, text })
  })
  let read = 0
  a.searches.forEach((s, i) => {
    const searchId = `${a.id}-s${i + 1}`
    const round = i + 1
    at(s.at - 0.1, { type: 'agent.status', agentId: a.id, status: 'searching', round, sourcesRead: read, note: null })
    at(s.at, { type: 'search.started', agentId: a.id, searchId, round, query: s.query })
    const refs = s.error ? [] : s.sources.map((id) => ref(S[id]))
    at(s.at + s.ms / 1000, { type: 'search.done', agentId: a.id, searchId, sources: refs, ms: s.ms, credits: s.error ? 0 : 1, error: s.error ?? null })
    if (!s.error) {
      read += refs.length
      at(s.at + s.ms / 1000 + 0.2, { type: 'agent.status', agentId: a.id, status: 'reading', round, sourcesRead: read, note: null })
      at(s.at + s.ms / 1000 + 1.6, { type: 'agent.status', agentId: a.id, status: 'thinking', round, sourcesRead: read, note: null })
    }
  })
  const firstFinding = Math.min(...a.findings.map((f) => f.at))
  at(firstFinding - 0.3, { type: 'agent.status', agentId: a.id, status: 'writing', round: a.searches.length, sourcesRead: read, note: null })
  for (const { at: t, f } of a.findings)
    at(t, { type: 'finding.added', finding: f, source: f.checks.sourceRetrieved ? S[f.sourceId] : null })
  at(a.end - 0.5, { type: 'scores.proposed', agentId: a.id, proposals: a.proposals })
  at(a.end, { type: 'agent.done', agentId: a.id, status: 'done', answer: a.answer, gaps: a.gaps, usage: a.usage, error: null })
}

// ---------- timeline ----------

at(0, { type: 'run.started', decision: MOCK_DECISION, inputMode: 'text', replay: false, replayOf: null, models: M })
at(0.2, { type: 'run.phase', phase: 'planning' })
const orchThoughts = [
  'Reading the decision: a one-day hackathon versus exam prep',
  'Pulling out constraints: 10–19 tomorrow, exam the day after, 40% weight',
  'Adding a third option — a partial day — the user didn’t list',
  'Splitting into four researchable questions',
  'Weighting exam performance highest; flagging one blind spot about the team',
]
orchThoughts.forEach((text, i) => {
  at(0.8 + i * 1.2, { type: 'reasoning.chunk', actorId: 'orchestrator', text: `Okay, ${text.toLowerCase()}. ` })
  at(1.1 + i * 1.2, { type: 'reasoning.summary', actorId: 'orchestrator', text })
})
at(7, { type: 'plan.ready', plan: PLAN, usage: usage(M.orchestrator, 6400, 1850, 2120, 1530, 0.0041) })
at(7.2, { type: 'run.phase', phase: 'researching' })

playAgent({
  id: 'a1', questionId: 'q1', effort: 'high', extraRounds: 2, start: 8, end: 44,
  summaries: ['Looking for evidence on last-day revision gains', 'Spaced practice beats massing; checking the size of the effect', 'Comparing one extra day against existing 70% prep', 'Drafting: the marginal day is worth less than it feels'],
  searches: [
    { at: 9, query: 'spaced revision final day exam score effect', sources: ['s1', 's3'], ms: 1800 },
    { at: 17, query: 'last day cramming vs rest exam performance', sources: ['s3', 's2'], ms: 2100 },
    { at: 26, query: 'marginal benefit extra study day 70 percent prepared', sources: ['s1'], ms: 1600 },
  ],
  findings: [
    { at: 31, f: finding('F1', 'a1', 'q1', 'Spaced study already done matters more than one extra massed day.', 'Students who spaced their study sessions retained substantially more material than those who massed study into a single session', 's1', ['o1', 'o3'], ['c1'], 'high') },
    { at: 35, f: finding('F2', 'a1', 'q1', 'For a test two days out, an extra cramming day gives only a small advantage.', 'the advantage of an extra massed day was small relative to prior spaced study', 's3', ['o1', 'o2', 'o3'], ['c1'], 'medium') },
    { at: 39, f: finding('F3', 'a1', 'q1', 'Sleep before an exam explains a large share of grade differences.', 'Sleep quality and duration together accounted for nearly a quarter of the variance in grades', 's2', ['o1', 'o3'], ['c1', 'c4'], 'high', { quote: 'partial', ratio: 0.86 }) },
  ],
  proposals: [
    prop('a1', 'o1', 'c1', 5, 'A full revision day plus sleep maximises expected score, though the gain is modest.', ['F1', 'F2']),
    prop('a1', 'o2', 'c1', 3, 'Losing the revision day costs a little; a late night costs more.', ['F2', 'F3']),
    prop('a1', 'o3', 'c1', 4, 'Evening revision and early sleep recover most of the benefit.', ['F2', 'F3']),
  ],
  answer: 'One extra day helps a little; sleep and your existing spaced prep matter more.',
  gaps: ['No study measured exactly 70% preparedness.'],
  usage: usage(M.agent, 35800, 14200, 3400, 2100, 0.0062),
})

playAgent({
  id: 'a2', questionId: 'q2', effort: 'low', extraRounds: 0, start: 8.3, end: 24,
  summaries: ['Checking what recruiters say about hackathons', 'Hackathons rank behind internships but ahead of GPA', 'Writing up the CV value'],
  searches: [
    { at: 9.4, query: 'do recruiters value hackathons student CV', sources: ['s4', 's5'], ms: 1500 },
    { at: 14, query: 'hackathon sponsor recruiting interviews students', sources: ['s5'], ms: 1300 },
  ],
  findings: [
    { at: 18, f: finding('F4', 'a2', 'q2', 'Hiring managers rate hackathon experience above GPA for many entry-level tech roles.', 'Hiring managers listed projects and hackathon experience among the top signals for entry-level candidates', 's4', ['o2', 'o3'], ['c2'], 'high') },
    { at: 21, f: finding('F5', 'a2', 'q2', 'Most hackathon participants get at least one job lead from sponsors.', 'Over 60% of participants receive a job lead from a sponsor at the event', 's5', ['o2', 'o3'], ['c2', 'c5'], 'medium', { quote: 'not_found', ratio: 0.21 }) },
  ],
  proposals: [
    prop('a2', 'o1', 'c2', 1, 'Skipping forgoes the CV line entirely.', ['F4']),
    prop('a2', 'o2', 'c2', 5, 'Full participation gives the strongest CV story.', ['F4']),
    prop('a2', 'o3', 'c2', 4, 'A partial day still counts as participation on a CV.', ['F4']),
    prop('a2', 'o1', 'c5', 1, 'No networking if you stay home.', []),
  ],
  answer: 'Hackathons are a solid CV signal, behind internships but ahead of grades for many roles.',
  gaps: ['Sponsor-lead statistic could not be verified.'],
  usage: usage(M.agent, 15700, 6100, 1300, 0, 0.0018),
})

playAgent({
  id: 'a3', questionId: 'q3', effort: 'high', extraRounds: 2, start: 8.6, end: 48,
  summaries: ['Looking at sleep and memory consolidation', 'A poor night cuts new-memory formation sharply', 'Checking whether next-day fatigue persists to day two', 'Fatigue mostly recovers after one full night — nuance for the full-day option'],
  searches: [
    { at: 9.8, query: 'sleep deprivation memory consolidation exam', sources: ['s6', 's2'], ms: 1900 },
    { at: 19, query: 'mental fatigue next day cognitive performance', sources: ['s7'], ms: 2300 },
    { at: 28, query: 'short break from study effect on retention', sources: ['s8'], ms: 1700 },
  ],
  findings: [
    { at: 33, f: finding('F6', 'a3', 'q3', 'A night of poor sleep can cut new-memory formation by up to 40%.', 'A night of poor sleep can reduce the ability to form new memories by up to 40 percent', 's6', ['o2'], ['c4', 'c1'], 'high') },
    { at: 38, f: finding('F7', 'a3', 'q3', 'After a full night’s sleep, recall largely recovers from a demanding day.', 'performance on recall tasks after a full night of sleep had largely recovered', 's7', ['o2', 'o3'], ['c4'], 'medium') },
    { at: 43, f: finding('F8', 'a3', 'q3', 'A short engaging break from study does not harm later retention.', 'A short engaging break from study did not harm, and in some participants modestly improved, subsequent retention', 's8', ['o3'], ['c1', 'c4'], 'medium') },
  ],
  proposals: [
    prop('a3', 'o1', 'c4', 4, 'Most rest, but a full day of revision is itself tiring.', ['F6']),
    prop('a3', 'o2', 'c4', 2, 'A 9-hour intense day risks a late, poor night.', ['F6', 'F7']),
    prop('a3', 'o3', 'c4', 4, 'Leaving at 15:00 leaves the evening free for sleep.', ['F7', 'F8']),
    prop('a3', 'o2', 'c1', 3, 'Fatigue mostly recovers, but sleep loss hurts consolidation.', ['F6', 'F7']),
  ],
  answer: 'A long day only hurts recall if it costs you sleep tomorrow night.',
  gaps: ['Evidence is from lab tasks, not real exams.'],
  usage: usage(M.agent, 39400, 15800, 3900, 2600, 0.0071),
})

playAgent({
  id: 'a4', questionId: 'q4', effort: 'low', extraRounds: 0, start: 8.9, end: 30,
  summaries: ['Searching for partial-day hackathon experiences', 'Most mentoring and team formation happens early', 'Writing up: the morning holds most of the value'],
  searches: [
    { at: 10.2, query: 'leave hackathon early still worth it', sources: [], ms: 3000, error: 'Tavily timeout after 3000 ms' },
    { at: 14.5, query: 'leave hackathon early still worth it', sources: ['s9', 's10'], ms: 1400 },
    { at: 20, query: 'hackathon learning outcomes part-time participation', sources: ['s9'], ms: 1500 },
  ],
  findings: [
    { at: 24, f: finding('F9', 'a4', 'q4', 'Team formation, workshops and mentoring mostly happen in the first half.', 'Most of the team formation, workshops and mentor time happens in the first half of the event', 's11', ['o3'], ['c3', 'c5'], 'medium', { retrieved: false }) },
    { at: 27, f: finding('F10', 'a4', 'q4', 'Participants who left early still reported getting most of the networking.', 'My team still submitted and I got most of the networking', 's10', ['o3'], ['c5', 'c3'], 'low') },
  ],
  proposals: [
    prop('a4', 'o1', 'c3', 1, 'No hackathon learning if you skip.', []),
    prop('a4', 'o2', 'c3', 5, 'The full day gives the most hands-on learning.', ['F9']),
    prop('a4', 'o3', 'c3', 4, 'The morning holds most workshops and mentoring.', ['F9', 'F10']),
    prop('a4', 'o2', 'c2', 5, 'Full day includes judging and demo.', ['F10']),
  ],
  answer: 'Most of the learning and networking happens before mid-afternoon.',
  gaps: ['Mostly anecdotal sources.'],
  usage: usage(M.agent, 21100, 7400, 1500, 0, 0.0021),
})
// Cells left unscored on purpose (2): o2|c5 and o3|c5.

at(16, { type: 'notice', level: 'info', message: 'Search for Q4 timed out once; retried successfully.' })

at(50, { type: 'run.phase', phase: 'checking' })
at(50.5, { type: 'reasoning.summary', actorId: 'auditor', text: 'Comparing findings across agents for conflicts' })
at(53, {
  type: 'contradictions.ready', usage: usage(M.audit, 2400, 3100, 260, 0, 0.0004), error: null,
  contradictions: [{ id: 'x1', findingIds: ['F6', 'F7'], severity: 'tension', model: M.audit,
    explanation: 'Q3 says a poor night sharply cuts memory formation, while another source says recall largely recovers after a full night — the difference is whether the hackathon costs you sleep.' }],
})
at(54, { type: 'run.phase', phase: 'synthesizing' })
at(54.2, { type: 'synthesis.started', version: 1 })
const synthThoughts = ['Weighing exam performance against CV value', 'Sleep is the factor that swings the exam side', 'Writing the if-you-value lines and questions to ask yourself']
synthThoughts.forEach((text, i) => {
  at(55 + i * 3, { type: 'reasoning.chunk', actorId: 'orchestrator', text: `${text}. ` })
  at(55.3 + i * 3, { type: 'reasoning.summary', actorId: 'orchestrator', text })
})
at(65, {
  type: 'synthesis.ready', usage: usage(M.orchestrator, 10600, 6900, 1700, 1100, 0.0039),
  synthesis: {
    version: 1,
    recommendation: 'It hinges on whether the hackathon costs you sleep before the exam',
    optionId: null, confidence: 'medium',
    summary: 'Your existing spaced prep matters more than one extra revision day, and the morning holds most of the hackathon’s value. The biggest swing factor is sleep: a long day only hurts the exam if it costs you a good night.',
    conditions: [
      'If you value the exam result most, skipping fits best — sleep explains nearly a quarter of the variance in grades.',
      'If you value the CV and recruiters most, the full day fits best — hiring managers rate hackathon experience above GPA for many entry-level roles.',
      'If you want a balance, leaving at 15:00 fits best — team formation, workshops and mentoring mostly happen in the first half.',
    ],
    reasons: [
      { text: 'An extra cramming day adds little for a test two days out.', findingIds: ['F1', 'F2'] },
      { text: 'Sleep before the exam matters a lot; one poor night can cut new-memory formation by up to 40%.', findingIds: ['F3', 'F6'] },
      { text: 'Most mentoring and networking happens before mid-afternoon.', findingIds: ['F9', 'F10'] },
    ],
    cruxes: ['Whether the hackathon costs you sleep tomorrow night', 'Whether your team is fine with you leaving early'],
    nextSteps: ['Would your team be fine with you leaving early?', 'How did a timed past paper go when you last tried one?', 'Can you realistically be asleep by 23:00 after a hackathon day?'],
    uncertainties: ['Sleep evidence comes from lab tasks, not real exams', 'One CV statistic could not be verified'],
    basedOnWeights: { c1: 9, c2: 6, c3: 5, c4: 7, c5: 3 },
    basedOnFactIds: ['f1', 'f2', 'f3', 'f4', 'f5'],
    createdAt: BASE_TS + 65_000,
  },
})

// ---------- conversation + shared memory (user.md) ----------

const userMd = (about: string[], matters: string[], constraints: string[], unknown: string[]) => [
  '# user.md',
  '',
  '## The decision',
  '- Go to a 10:00–19:00 hackathon tomorrow, or revise for an ML exam the day after?',
  '',
  '## About you',
  ...about.map((x) => `- ${x}`),
  '',
  '## What matters to you',
  ...matters.map((x) => `- ${x}`),
  '',
  '## Constraints',
  ...constraints.map((x) => `- ${x}`),
  '',
  '## Still unknown',
  ...unknown.map((x) => `- ${x}`),
].join('\n')

const ABOUT0 = ['Student, about 70% prepared for the exam']
const MATTERS0 = ['CV and learning from the hackathon', 'Not tanking the exam']
const CONSTRAINTS0 = ['Hackathon tomorrow 10:00–19:00', 'Exam the day after, worth 40% of the module']
const UNKNOWN0 = ['How big the hackathon is', 'How past exams have gone', 'Whether this is a resit', 'Whether the team would mind you leaving early']

let chatN = 0
const say = (t: number, role: 'user' | 'assistant', text: string, suggestions: string[] = [], recommendedIndex: number | null = null) =>
  at(t, { type: 'chat.message', id: `m${++chatN}`, role, text, suggestions, recommendedIndex })
const remember = (t: number, markdown: string, changes: string[], by: string) =>
  at(t, { type: 'memory.updated', markdown, changes, by })

say(0.05, 'user', MOCK_DECISION)
remember(0.1, userMd(ABOUT0, MATTERS0, CONSTRAINTS0, UNKNOWN0), ['Started user.md from your first message'], 'orchestrator')

say(2, 'assistant', "I've started looking into revision, sleep and how much hackathons help a CV. While that runs — how big is this hackathon for you?",
  ['Just for fun', 'Decent prizes', 'Big: sponsors and recruiters'], null)

say(10, 'user', 'Big: sponsors and recruiters')
const MATTERS1 = [...MATTERS0, 'Big hackathon with recruiters: the career upside is real']
remember(10.2, userMd(ABOUT0, MATTERS1, CONSTRAINTS0, UNKNOWN0.slice(1)), ['Big hackathon with recruiters'], 'orchestrator')
say(11, 'assistant', 'That raises the career side. How did your last ML-style exam go?',
  ['Comfortable pass', 'Scraped through', 'Failed it', 'First one'], 1)

say(20, 'user', 'Scraped through')
const ABOUT2 = [...ABOUT0, 'Scraped through the last ML-style exam']
remember(20.2, userMd(ABOUT2, MATTERS1, CONSTRAINTS0, UNKNOWN0.slice(2)), ['Scraped through the last ML-style exam: exam risk is higher'], 'orchestrator')
say(21, 'assistant', 'Noted. That makes the exam side heavier. Is this a resit?',
  ['First attempt', "It's a resit", 'Resit possible if I fail'], null)

say(66, 'assistant', [
  'The research is in. Here is what your decision hinges on:',
  '',
  '- **Sleep tomorrow night.** One poor night can cut new-memory formation by up to 40%, and sleep explains nearly a quarter of the variance in grades. A long day only hurts if it costs you sleep.',
  '- **The extra revision day is worth less than it feels.** For a test two days out, an extra cramming day gave only a small advantage over the spaced study you have already done.',
  '- **The career side is real.** Hiring managers rank hackathon experience above GPA for many entry-level tech roles, and most mentoring and team formation happens in the first half of the day.',
  '',
  'If you value the exam result most → a full revision day and an early night protects it best.',
  'If you value the CV and recruiters most → the full day gives the strongest story, as long as you still sleep.',
  'If you want a balance → the morning holds most of the hackathon’s value, and leaving mid-afternoon protects the evening.',
  '',
  'One thing only you can answer: would your team be fine with you leaving early?',
].join('\n'), ['Yes, they would be fine', 'They would rely on me', "I don't have a team yet"], null)

// stats.updated every 2 s
const END = 66
const agentWindows: [number, number][] = [[8, 44], [8.3, 24], [8.6, 48], [8.9, 30]]
for (let t = 2; t <= END; t += 2) {
  const f = Math.min(1, t / END)
  const agentMsSum = agentWindows.reduce((s, [a, b]) => s + Math.max(0, Math.min(t, b) - a), 0) * 1000
  const agentPhaseWallMs = Math.max(0, Math.min(t, 48) - 8) * 1000
  const findingsSoFar = out.filter((x) => x.body.type === 'finding.added' && x.t <= t).map((x) => (x.body as { finding: Finding }).finding)
  const searchesSoFar = out.filter((x) => x.body.type === 'search.started' && x.t <= t).length
  const cost = 0.0256 * f
  const stats: RunStats = {
    wallMs: t * 1000, agentPhaseWallMs, agentMsSum,
    speedup: agentPhaseWallMs > 0 ? Math.round((agentMsSum / agentPhaseWallMs) * 100) / 100 : 1,
    llmCalls: Math.round(2 + 18 * f), tavilySearches: searchesSoFar, tavilyCredits: searchesSoFar,
    inputTokens: Math.round(55_000 * f), outputTokens: Math.round(14_000 * f), reasoningTokens: Math.round(7_300 * f),
    costUsd: Math.round(cost * 10_000) / 10_000,
    // Planner, synthesizer and research agents all run on the same DeepSeek model, so they share one entry.
    byModel: {
      [M.agent]: { calls: (t >= 65 ? 2 : 1) + Math.round(16 * f), inputTokens: Math.round(52_200 * f), outputTokens: Math.round(13_900 * f), reasoningTokens: Math.round(7_300 * f), costUsd: Math.round(0.0252 * f * 10_000) / 10_000 },
    },
    findings: findingsSoFar.length,
    quoteVerified: findingsSoFar.filter((x) => x.checks.quote === 'verified').length,
    quotePartial: findingsSoFar.filter((x) => x.checks.quote === 'partial').length,
    quoteNotFound: findingsSoFar.filter((x) => x.checks.quote === 'not_found').length,
    noQuote: findingsSoFar.filter((x) => x.checks.quote === 'no_quote').length,
    sourceNotRetrieved: findingsSoFar.filter((x) => !x.checks.sourceRetrieved).length,
    contradictions: t >= 53 ? 1 : 0, jsonRepairs: 1, fingerprint: 'fp_mock_7c1a',
  }
  at(t + 0.05, { type: 'stats.updated', stats })
}
at(END + 0.5, { type: 'run.phase', phase: 'done' })

// ---------- export ----------

export const MOCK_EVENTS: CruxEvent[] = out
  .map((x, i) => ({ ...x, i }))
  .sort((a, b) => a.t - b.t || a.i - b.i)
  .map((x, i) => ({ ...x.body, seq: i + 1, ts: BASE_TS + Math.round(x.t * 1000), runId: MOCK_RUN_ID }) as CruxEvent)

/** Statuses the mock walks through (handy for UI checks). */
export const MOCK_AGENT_STATUSES: AgentStatus[] = ['queued', 'searching', 'reading', 'thinking', 'writing', 'done']

type StoreLike = { getState(): Pick<CruxStore, 'reset' | 'ingest'> }

/**
 * Plays the mock script into the store with real-time delays (divided by `speed`).
 * Event `ts` values are rebased to the wall clock so elapsed timers look right. Returns a cancel function.
 */
export function playMock(store: StoreLike, speed = 1): () => void {
  store.getState().reset({ mock: true })
  const start = Date.now()
  const timers: ReturnType<typeof setTimeout>[] = []
  for (const e of MOCK_EVENTS) {
    const offset = (e.ts - BASE_TS) / speed
    const ts = start + offset
    const ev: CruxEvent = e.type === 'agent.spawned'
      ? { ...e, ts, agent: { ...e.agent, startedAt: start + (e.agent.startedAt - BASE_TS) / speed } }
      : e.type === 'synthesis.ready'
        ? { ...e, ts, synthesis: { ...e.synthesis, createdAt: ts } }
        : e.type === 'stats.updated'
          // Scale the scripted durations too, so the header timer at done matches the sped-up play time.
          ? { ...e, ts, stats: { ...e.stats, wallMs: e.stats.wallMs / speed, agentMsSum: e.stats.agentMsSum / speed } }
          : { ...e, ts }
    timers.push(setTimeout(() => store.getState().ingest(ev), offset))
  }
  return () => timers.forEach(clearTimeout)
}

/** Reads `?mock=1` / `?mock=fast` from the URL. Returns the speed to play at, or null when mock mode is off. */
export function mockSpeedFromUrl(search: string = typeof location === 'undefined' ? '' : location.search): number | null {
  const v = new URLSearchParams(search).get('mock')
  if (v === null || v === '0') return null
  return v === 'fast' ? 3 : 1
}
