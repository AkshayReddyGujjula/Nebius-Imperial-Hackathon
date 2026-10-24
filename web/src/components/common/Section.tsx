import type { ReactNode } from 'react'

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`ui-label ${className ?? ''}`}>{children}</div>
}

export function Section({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-insp-sec">
      {title ? <div className="mb-2 flex items-center gap-2"><Label className="flex-1">{title}</Label>{aside}</div> : null}
      {children}
    </section>
  )
}
