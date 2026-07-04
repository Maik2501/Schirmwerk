/**
 * Design-Bibliothek im Panel: aktuelle Einstellung benennen und sichern,
 * gespeicherte Designs mit Mini-Riss-Vorschau laden/teilen/löschen,
 * die ganze Bibliothek als JSON-Datei exportieren oder importieren.
 *
 * Persistenz und Validierung leben in state/designs.ts – diese Komponente
 * ist nur die Oberfläche darüber.
 */
import { useMemo, useRef, useState } from 'react'
import { radiusAt, TWO_PI } from '../geometry/surface'
import type { ShadeParams } from '../geometry/types'
import {
  cryptoRandomId,
  encodeShare,
  loadDesigns,
  parseLibraryJson,
  persistDesigns,
  type SavedDesign,
} from '../state/designs'
import { useStudio } from '../state/store'

/** Kleine Silhouette als Wiedererkennungs-Thumbnail (reiner SVG-Umriss). */
function MiniRiss({ params }: { params: ShadeParams }) {
  const { points, maxR } = useMemo(() => {
    const rows = 28
    const thetaSamples = 48
    const pts: [number, number][] = []
    let maxR = 0
    for (let i = 0; i <= rows; i++) {
      const z = (i / rows) * params.heightMm
      let hi = 0
      for (let j = 0; j < thetaSamples; j++) {
        hi = Math.max(hi, radiusAt(params, (j / thetaSamples) * TWO_PI, z))
      }
      pts.push([hi, z])
      maxR = Math.max(maxR, hi)
    }
    return { points: pts, maxR }
  }, [params])

  const H = params.heightMm
  const poly = (sign: 1 | -1) =>
    points.map(([r, z]) => `${(sign * r).toFixed(1)},${z.toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`${-maxR - 4} -4 ${2 * (maxR + 4)} ${H + 8}`}
      className="h-12 w-9 shrink-0"
      aria-hidden
    >
      <g transform={`scale(1,-1) translate(0,${-H})`}>
        <polyline points={poly(1)} fill="none" stroke="var(--color-bernstein)" strokeOpacity={0.8} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polyline points={poly(-1)} fill="none" stroke="var(--color-bernstein)" strokeOpacity={0.8} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <line x1={-maxR} y1={0} x2={maxR} y2={0} stroke="var(--color-asche)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

export function Library() {
  const params = useStudio((s) => s.params)
  const shadeColor = useStudio((s) => s.shadeColor)
  const mounting = useStudio((s) => s.mounting)
  const applyDesign = useStudio((s) => s.applyDesign)

  const [designs, setDesigns] = useState<SavedDesign[]>(() => loadDesigns())
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (next: SavedDesign[]) => {
    setDesigns(next)
    persistDesigns(next)
  }

  const flash = (text: string) => {
    setFeedback(text)
    setTimeout(() => setFeedback(null), 2500)
  }

  const save = () => {
    const design: SavedDesign = {
      id: cryptoRandomId(),
      name: name.trim() || `Design ${designs.length + 1}`,
      savedAt: new Date().toISOString(),
      params,
      shadeColorId: shadeColor.id,
      mounting,
    }
    update([design, ...designs])
    setName('')
    flash(`„${design.name}“ gespeichert`)
  }

  const share = async (design: SavedDesign) => {
    const url = `${location.origin}${location.pathname}#d=${encodeShare(design)}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Link kopiert – einfach verschicken')
    } catch {
      flash('Kopieren blockiert – Link steht in der Adresszeile')
      location.hash = `d=${encodeShare(design)}`
    }
  }

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(designs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schirmwerk-designs.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const importFile = async (file: File) => {
    const imported = parseLibraryJson(await file.text())
    if (imported.length === 0) {
      flash('Keine gültigen Designs in der Datei')
      return
    }
    // vorhandene ids nicht doppeln – Importe bekommen frische
    const withFreshIds = imported.map((d) => ({ ...d, id: cryptoRandomId() }))
    update([...withFreshIds, ...designs])
    flash(`${imported.length} Design(s) importiert`)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={`Design ${designs.length + 1}`}
          aria-label="Name des Designs"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-kohle px-2 py-1.5 text-xs text-porzellan placeholder:text-asche/60 outline-none focus:border-bernstein"
        />
        <button
          type="button"
          onClick={save}
          className="shrink-0 rounded-md border border-bernstein/40 bg-bernstein/10 px-3 py-1.5 text-xs text-bernstein transition-colors hover:bg-bernstein/20"
        >
          Speichern
        </button>
      </div>

      {feedback && <p className="font-mono text-[10px] text-bernstein">{feedback}</p>}

      {designs.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-asche">
          Noch nichts gespeichert. Designs landen lokal im Browser – zum
          Sichern über Geräte hinweg die Datei-Buttons nutzen.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {designs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-md border border-white/5 bg-kohle/60 px-2 py-1.5"
            >
              <MiniRiss params={d.params} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-porzellan">{d.name}</p>
                <p className="font-mono text-[9px] text-asche">
                  {d.savedAt ? new Date(d.savedAt).toLocaleDateString('de-DE') : ''} ·{' '}
                  {d.mounting === 'stehend' ? 'stehend' : 'hängend'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => applyDesign(d)}
                  className="rounded px-1.5 py-1 text-[10px] text-bernstein transition-colors hover:bg-rauch"
                >
                  Laden
                </button>
                <button
                  type="button"
                  onClick={() => share(d)}
                  className="rounded px-1.5 py-1 text-[10px] text-asche transition-colors hover:bg-rauch hover:text-porzellan"
                >
                  Teilen
                </button>
                <button
                  type="button"
                  aria-label={`${d.name} löschen`}
                  onClick={() => update(designs.filter((x) => x.id !== d.id))}
                  className="rounded px-1.5 py-1 text-[10px] text-asche transition-colors hover:bg-rauch hover:text-signal"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={exportFile}
          disabled={designs.length === 0}
          className="flex-1 rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-asche transition-colors hover:border-white/25 hover:text-porzellan disabled:pointer-events-none disabled:opacity-40"
        >
          Als Datei sichern
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-asche transition-colors hover:border-white/25 hover:text-porzellan"
        >
          Datei laden
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
