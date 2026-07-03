/** Einklappbare Panel-Gruppe (Form / Wellen / Fassung / Export). */
import { useState, type ReactNode } from 'react'

interface GroupProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Group({ title, defaultOpen = true, children }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-white/5 bg-rauch/80">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium tracking-wide text-porzellan"
      >
        {title}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={'text-asche transition-transform ' + (open ? 'rotate-180' : '')}
        >
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && <div className="space-y-4 px-4 pt-1 pb-4">{children}</div>}
    </section>
  )
}
