import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { selectMatrix } from '@/store/selectors'

/**
 * Matrix numbers come only from `selectMatrix` (→ @shared/matrix). We subscribe to its inputs and
 * call it in a memo so the component never depends on the selector returning a stable object.
 */
export function useMatrix() {
  const inputs = useCrux(useShallow((s) => ({ plan: s.plan, proposals: s.proposals, overrides: s.overrides, weights: s.weights })))
  return useMemo(() => selectMatrix({ ...useCrux.getState(), ...inputs }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs.plan, inputs.proposals, inputs.overrides, inputs.weights])
}
