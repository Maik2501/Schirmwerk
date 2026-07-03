/**
 * Regler + Zahleneingabe als Kombi-Control.
 * Der Anzeigewert ist bereits nutzerseitig umgerechnet (z. B. Durchmesser
 * statt Radius, Prozent statt Faktor) – die Umrechnung passiert im Panel.
 * Zahlen laufen in IBM Plex Mono (tabellarische Ziffern, nichts springt).
 */
import { useState } from 'react'

interface SliderInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
}

export function SliderInput({ label, value, min, max, step, unit, disabled, onChange }: SliderInputProps) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  // draft = gerade getippter Text; null = Anzeige folgt dem Store-Wert
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  const commitDraft = () => {
    if (draft === null) return
    const v = Number(draft.replace(',', '.'))
    if (Number.isFinite(v)) onChange(clamp(v))
    setDraft(null)
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-40 select-none' : ''}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-asche">{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            disabled={disabled}
            value={draft ?? value.toFixed(decimals)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              if (e.key === 'Escape') setDraft(null)
            }}
            className="w-16 border-b border-white/10 bg-transparent text-right font-mono text-xs text-porzellan outline-none focus:border-bernstein"
          />
          {unit && <span className="w-6 font-mono text-[10px] text-asche">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={clamp(value)}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-1 w-full accent-bernstein"
      />
    </div>
  )
}
