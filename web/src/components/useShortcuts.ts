import { useEffect } from 'react'
import { useCrux } from '@/store/runStore'

/** §13.5: D toggles Simple/Detailed, M toggles the matrix, F fits the view, Esc closes the inspector. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      const s = useCrux.getState()
      if (e.key === 'Escape') {
        if (typing) { t?.blur(); return }
        if (s.selectedNodeId || s.selectedCellKey) { s.select(null); s.selectCell(null) }
        return
      }
      if (typing) return
      const k = e.key.toLowerCase()
      if (k === 'd') s.setViewMode(s.viewMode === 'simple' ? 'detailed' : 'simple')
      else if (k === 'm' && s.plan) s.setMatrixOpen(!s.matrixOpen)
      else if (k === 'f') {
        // DECISION: fit is owned by the Canvas (Lane W1); trigger its Fit button rather than reaching into React Flow.
        document.querySelector<HTMLButtonElement>('[aria-label="Fit to view"]')?.click()
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
