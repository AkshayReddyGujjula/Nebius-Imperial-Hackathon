import { MODEL_FAMILIES, type ModelFamily } from '../helpers'
import './models.css'

/** Coloured dot + short model name. `micro` for inline tags on status lines. */
export function ModelBadge({ family, micro = false, title }: { family: ModelFamily; micro?: boolean; title?: string }) {
  const m = MODEL_FAMILIES[family]
  return (
    <span className={`cx-model m-${family}${micro ? ' is-micro' : ''}`} title={title ?? m.full}>
      <span className="cx-model-dot" aria-hidden />
      {m.short}
    </span>
  )
}

/** Marks a live one-line status as written by Nemotron. */
export function NemotronTag() {
  return <ModelBadge family="nemotron" micro title="Status line written by Nemotron 3.5 Lightning" />
}
