// Dev-only page (/src/dev/mock-harness.html?mock=fast): plays the mock into the real store and logs state.
import { useCrux } from '@/store/runStore'
import { selectMatrix, selectTopStatus } from '@/store/selectors'
import { mockSpeedFromUrl, playMock } from './mockRun'

const speed = mockSpeedFromUrl() ?? 10
playMock(useCrux, speed)
const out = document.getElementById('out')!
const timer = setInterval(() => {
  const s = useCrux.getState()
  const summary = {
    phase: s.phase, status: selectTopStatus(s).label, lastSeq: s.lastSeq, mock: s.mock,
    agents: Object.keys(s.agents).length, findings: Object.keys(s.findings).length,
    contradictions: s.contradictions.length, synthesis: !!s.synthesis, activity: s.activity.length,
    leader: selectMatrix(s).leader?.optionId ?? null,
  }
  out.textContent = JSON.stringify(summary, null, 2)
  if (s.phase === 'done') { console.log('MOCK_DONE', JSON.stringify(summary)); clearInterval(timer) }
}, 250)
