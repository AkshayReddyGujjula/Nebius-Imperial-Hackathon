import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { MODEL_CHOICES, PRESETS, getRunModels, setRunModels } from '@/lib/modelPrefs'

const ROLES = [
  { key: 'orchestrator', label: 'Orchestrator', hint: 'plans, chats, writes the summary' },
  { key: 'agent', label: 'Research agents', hint: '4 in parallel, search the web' },
  { key: 'audit', label: 'Review agent', hint: 'checks the agents for contradictions' },
] as const

/** Small "Models" menu on the start page: presets with the reason for each, plus a per-role picker. */
export function ModelMenu() {
  const [open, setOpen] = useState(false)
  const [m, setM] = useState(getRunModels)
  const update = (next: typeof m) => { setM(next); setRunModels(next) }
  const active = PRESETS.find((p) => p.models.orchestrator === m.orchestrator && p.models.agent === m.agent && p.models.audit === m.audit)
  return (
    <div className="relative">
      <button type="button" className="ui-link inline-flex items-center gap-1.5 !font-normal !text-crux-text-tertiary hover:!text-crux-text" onClick={() => setOpen(!open)}>
        <Settings2 className="!size-4" />Models · {active ? active.name : 'Custom'}
      </button>
      {open ? (
        <div className="absolute left-1/2 z-30 mt-2 w-[520px] max-w-[90vw] -translate-x-1/2 rounded-xl border border-crux-border-strong bg-crux-surface p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,.35)]">
          <div className="mb-2 text-[13px] font-semibold">Presets</div>
          <div className="flex flex-col gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => update(p.models)}
                className={`rounded-lg border px-3 py-2 text-left ${active?.id === p.id ? 'border-crux-accent bg-crux-hover' : 'border-crux-border hover:bg-crux-hover'}`}>
                <div className="text-[13.5px] font-medium">{active?.id === p.id ? '✓ ' : ''}{p.name}</div>
                <div className="text-[12px] leading-[17px] text-crux-text-secondary">{p.why}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 mb-2 text-[13px] font-semibold">Or pick per role <span className="font-normal text-crux-text-tertiary">· open models on Nebius Token Factory</span></div>
          <div className="flex flex-col gap-2">
            {ROLES.map((r) => (
              <label key={r.key} className="grid grid-cols-[160px_1fr] items-center gap-3 text-[13px]">
                <span>{r.label}<span className="block text-[11.5px] text-crux-text-tertiary">{r.hint}</span></span>
                <select value={m[r.key]} onChange={(e) => update({ ...m, [r.key]: e.target.value })}
                  className="h-9 rounded-lg border border-crux-border bg-crux-page px-2 text-[13px] text-crux-text">
                  {MODEL_CHOICES[r.key].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-crux-text-tertiary">Applies to the next decision you start. Live status lines always use NVIDIA Nemotron.</p>
        </div>
      ) : null}
    </div>
  )
}
