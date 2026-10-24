import { useCrux } from '../store/runStore'

export function Canvas() {
  const decision = useCrux((s) => s.decision)
  return <div className="h-full w-full" data-crux-canvas>{decision}</div>
}
