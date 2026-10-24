import { useState, type ReactNode } from 'react'
import { Loader, Search } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { EFFORT_ORDER, type Effort } from '@shared/index'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { selectRecommendationStale } from '@/store/selectors'
import { answerBlindSpot, digDeeper, dismissBlindSpot, researchBlindSpot, runLadder, synthesize } from '@/lib/api'
import { fmtMs, fmtTokens, fmtUsd, pct } from '@/lib/format'
import { effortWord } from '../common/EffortBadge'
import { MicButton } from '../MicButton'

/** Runs an API call for the live run; mock data has no server, so actions explain that instead. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mock = useCrux((s) => s.mock)
  const replay = useCrux((s) => s.replay)
  const run = async (fn: (runId: string) => Promise<unknown>) => {
    const runId = useCrux.getState().runId
    if (replay) { setError('Not available on a replay — start a live run.'); return }
    if (mock || !runId) { setError('Not available on mock data — start a live run.'); return }
    setBusy(true); setError(null)
    try { await fn(runId) } catch (e) { setError(e instanceof Error ? e.message : 'Request failed') } finally { setBusy(false) }
  }
  return { busy, error, run }
}

export const REPLAY_NOTE = 'Not available on a replay — start a live run.'

/** One muted note per panel explaining why its follow-up buttons are disabled on a replay. */
export function ReplayNote() {
  const replay = useCrux((s) => s.replay)
  return replay ? <p className="text-[12px] leading-4 text-crux-text-tertiary">{REPLAY_NOTE}</p> : null
}

function Err({ text }: { text: string | null }) {
  return text ? <p className="text-[12px] leading-4 text-crux-warn">{text}</p> : null
}

function Btn({ busy, children, className, live, step, ...rest }: { busy: boolean; children: ReactNode; live?: boolean; step?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const replay = useCrux((s) => s.replay)
  const off = live && replay
  return (
    <>
      <button type="button" aria-busy={busy} className={`ui-btn inline-flex items-center justify-center gap-2 ${className ?? ''}`} {...rest} disabled={busy || rest.disabled || off} title={off ? REPLAY_NOTE : rest.title}>
        {busy ? <><Loader className="ui-spin" />{step ?? children}</> : children}
      </button>
      {busy ? <div className="dl-inline-progress dl-fade-in" role="progressbar" aria-label={step ?? 'Working'} /> : null}
    </>
  )
}

const bump = (e: Effort): Effort => EFFORT_ORDER[Math.min(EFFORT_ORDER.length - 1, EFFORT_ORDER.indexOf(e) + 1)]

// ---------- Question: dig deeper + effort ladder ----------

export function QuestionActions({ questionId }: { questionId: string }) {
  const q = useCrux((s) => s.plan?.questions.find((x) => x.id === questionId))
  const status = useCrux((s) => s.agents[s.agentByQuestion[questionId] ?? '']?.status)
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  const select = useCrux((s) => s.select)
  const deeper = useAction()
  const ladder = useAction()
  const ladderRunning = useCrux((s) => Object.values(s.ladders).some((l) => l.questionId === questionId && Object.values(l.arms).some((a) => a?.status === 'running')))
  if (!q) return null
  const finished = status === 'done' || status === 'failed' || status === 'timeout'
  return (
    <>
      <Btn live busy={deeper.busy} step="Starting a deeper agent…" className="primary wide" disabled={!finished}
        title={finished ? undefined : 'Available once this branch finishes'}
        onClick={() => deeper.run(async (runId) => {
          const r = await digDeeper(runId, { nodeId: nodeId.question(questionId) })
          select(nodeId.question(r.questionId))
        })}>
        <Search />Dig deeper at {effortWord(bump(q.effort))} effort
      </Btn>
      <Err text={deeper.error} />
      <ReplayNote />
      {detailed ? (
        <>
          <Btn live busy={ladder.busy || ladderRunning} step="Comparing Low, High and Max…" className="wide" disabled={!finished}
            onClick={() => ladder.run((runId) => runLadder(runId, { questionId }))}>
            Compare effort levels
          </Btn>
          <Err text={ladder.error} />
        </>
      ) : null}
    </>
  )
}

/** Effort ladder: the same question at Low / High / Max on frozen sources. */
export function LadderCard({ questionId }: { questionId: string }) {
  const ladder = useCrux(useShallow((s) => {
    const all = Object.values(s.ladders).filter((l) => l.questionId === questionId)
    return all[all.length - 1] ?? null
  }))
  if (!ladder) return null
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {EFFORT_ORDER.map((e) => {
          const a = ladder.arms[e]
          return (
            <div key={e} className="rounded-[8px] border border-crux-border p-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                {effortWord(e)}{!a || a.status === 'running' ? <Loader className="ui-spin !size-3 text-crux-text-quaternary" /> : null}
              </div>
              {a && a.status !== 'running' ? (
                a.status === 'failed' ? <p className="mt-1 text-[11px] leading-4 text-crux-bad">{a.error ?? 'Failed'}</p> : (
                  <dl className="ui-num mt-1.5 grid gap-0.5 text-[11px] leading-4 text-crux-text-secondary">
                    <div>{fmtMs(a.ms)}</div>
                    <div>{fmtTokens(a.reasoningTokens)} reasoning</div>
                    <div>{fmtUsd(a.costUsd)}</div>
                    <div>{a.findings} findings · {pct(a.quotePassRate)} quotes ok</div>
                    <p className="ui-clamp-4 mt-1 font-sans text-[12px] leading-4 text-crux-text">{a.answer}</p>
                  </dl>
                )
              ) : <p className="mt-1 text-[11px] text-crux-text-tertiary">Running…</p>}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-crux-text-tertiary">n = 1 per effort level. A live instrument, not a benchmark.</p>
    </div>
  )
}

// ---------- Finding: dig deeper on this claim ----------

export function FindingActions({ findingId }: { findingId: string }) {
  const select = useCrux((s) => s.select)
  const a = useAction()
  return (
    <div className="flex flex-col gap-2">
      <Btn live busy={a.busy} step="Starting a deeper agent…" className="wide" onClick={() => a.run(async (runId) => {
        const r = await digDeeper(runId, { nodeId: nodeId.finding(findingId) })
        select(nodeId.question(r.questionId))
      })}><Search />Dig deeper on this claim</Btn>
      <Err text={a.error} />
      <ReplayNote />
    </div>
  )
}

// ---------- Blind spot: research / answer / dismiss ----------

export function BlindSpotActions() {
  const bs = useCrux((s) => s.plan?.blindSpot ?? null)
  const select = useCrux((s) => s.select)
  const [answer, setAnswer] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const research = useAction()
  const save = useAction()
  const dismiss = useAction()
  const canUpdate = useCrux((s) => s.synthesisStatus === 'failed' || (s.synthesis !== null && (s.synthesisStatus === 'running' || selectRecommendationStale(s).stale)))
  if (bs?.status === 'answered' && canUpdate) {
    // The stale banner's button sits under this overlay, so offer the update right where the answer was saved.
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] leading-[18px] text-crux-text-secondary">Saved. Update the brief to take your answer into account.</p>
        <UpdateRecommendation primary />
      </div>
    )
  }
  if (!bs || bs.status !== 'open') return null

  const onDismiss = () => {
    const s = useCrux.getState()
    // DECISION: same as BlindSpotNode — the mock run has no server, so Dismiss updates the store directly.
    if (s.mock || !s.runId) {
      if (s.plan?.blindSpot) useCrux.setState({ plan: { ...s.plan, blindSpot: { ...s.plan.blindSpot, status: 'dismissed' } }, selectedNodeId: null })
      return
    }
    void dismiss.run((runId) => dismissBlindSpot(runId))
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="ui-label mb-2">Answer it</div>
        <textarea id="crux-blindspot-answer" className="ui-field" rows={3} value={answer}
          placeholder="Type or say it — e.g. Resits are in August, capped at 40%"
          onChange={(e) => setAnswer(e.target.value)} />
        <div className="mt-2 flex items-center gap-2">
          <MicButton small onError={setMicError} onText={(t) => setAnswer((a) => (a.trim() ? `${a.trim()} ${t}` : t))} />
          <Btn busy={save.busy} className="primary" disabled={answer.trim().length < 2}
            onClick={() => save.run(async (runId) => { await answerBlindSpot(runId, { answer: answer.trim() }); setAnswer('') })}>
            Save answer
          </Btn>
          <span className="text-[12px] text-crux-text-tertiary">Added to what Decision Lab knows about you.</span>
        </div>
        <Err text={save.error ?? micError} />
      </div>
      <div className="flex flex-wrap gap-2">
        {bs.researchable ? (
          <Btn live busy={research.busy} onClick={() => research.run(async (runId) => {
            const r = await researchBlindSpot(runId)
            select(nodeId.question(r.questionId))
          })}><Search />Research it</Btn>
        ) : null}
        <Btn busy={dismiss.busy} className="ghost" onClick={onDismiss}>Dismiss</Btn>
      </div>
      <Err text={research.error ?? dismiss.error} />
      {bs.researchable ? <ReplayNote /> : null}
    </div>
  )
}

// ---------- Decision brief: update ----------

export function UpdateRecommendation({ primary = false }: { primary?: boolean }) {
  const a = useAction()
  const running = useCrux((s) => s.synthesisStatus === 'running')
  return (
    <div className="flex flex-col gap-1.5">
      <Btn live busy={a.busy || running} step={running ? 'Updating the brief…' : 'Sending your weights…'} className={primary ? 'primary self-start' : 'sm self-start'}
        onClick={() => a.run((runId) => synthesize(runId, { weights: useCrux.getState().weights }))}>
        Update the brief
      </Btn>
      <Err text={a.error} />
      <ReplayNote />
    </div>
  )
}
