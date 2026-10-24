import { Check } from 'lucide-react'
import { useCrux } from '../store/runStore'

const STEPS = ['Understand you', 'Research', 'Check quotes', 'Cross-examine', 'Decide']
const TERMINAL = ['done', 'failed', 'timeout']

/** Five-step journey across the top of the canvas, driven by the run phase. Purely decorative (pointer-events: none). */
export function StageProgress() {
  const step = useCrux((s) => {
    switch (s.phase) {
      case 'planning': return 0
      case 'researching': {
        const all = Object.values(s.agents)
        return all.length > 0 && all.every((a) => TERMINAL.includes(a.status)) ? 2 : 1
      }
      case 'checking': return 3
      case 'synthesizing': return 4
      case 'done': return 5
      default: return -1
    }
  })
  if (step < 0) return null
  return (
    <ol className="cx-steps" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} data-state={i < step ? 'done' : i === step ? 'active' : 'todo'}>
          <span className="cx-step-dot">{i < step ? <Check className="!size-3" strokeWidth={3} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}
