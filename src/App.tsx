import { useState } from 'react'
import { Scene } from './viewport/Scene'
import { Panel } from './panel/Panel'
import { useStudio } from './state/store'

/**
 * Layout: Viewport als Bühne links, schlankes Parameter-Panel rechts.
 * Unter lg wird das Panel zum aufziehbaren Sheet (Button unten rechts).
 */
export default function App() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-kohle text-porzellan">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold tracking-[0.22em]">SCHIRMWERK</span>
          <span className="hidden text-xs text-asche md:inline">
            Lampenschirm-Generator · Vase-Mode
          </span>
        </div>
        <LightControls />
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <Scene />
          </div>
          {/* dezente Vignette über dem Canvas – Bühnenlicht-Gefühl */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(23,19,16,0.6) 100%)',
            }}
          />
          <p className="pointer-events-none absolute bottom-3 left-5 hidden font-mono text-[11px] text-asche/70 sm:block">
            Ziehen: drehen · Scrollen: zoomen · Rechte Maustaste: verschieben
          </p>

          {/* Panel-Aufklapper für schmale Screens */}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="absolute right-4 bottom-4 rounded-full border border-white/10 bg-rauch px-4 py-2 text-sm text-porzellan shadow-lg lg:hidden"
          >
            Parameter
          </button>
        </main>

        {/* Backdrop fürs mobile Sheet */}
        {panelOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setPanelOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className={
            'fixed inset-y-0 right-0 z-40 w-[320px] transform border-l border-white/5 bg-kohle transition-transform ' +
            'lg:static lg:z-auto lg:w-[340px] lg:shrink-0 lg:transform-none ' +
            (panelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
          }
          aria-label="Parameter"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end border-b border-white/5 px-3 py-1.5 lg:hidden">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded px-2 py-1 text-xs text-asche hover:text-porzellan"
              >
                Schließen ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Panel />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function LightControls() {
  const bulbOn = useStudio((s) => s.bulbOn)
  const brightness = useStudio((s) => s.bulbBrightness)
  const toggleBulb = useStudio((s) => s.toggleBulb)
  const setBulbBrightness = useStudio((s) => s.setBulbBrightness)

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label="Licht dimmen"
        min={10}
        max={100}
        step={1}
        value={Math.round(brightness * 100)}
        onChange={(e) => setBulbBrightness(e.target.valueAsNumber / 100)}
        disabled={!bulbOn}
        className={'hidden h-1 w-24 accent-bernstein sm:block ' + (bulbOn ? '' : 'opacity-40')}
      />
      <button
        type="button"
        aria-pressed={bulbOn}
        onClick={toggleBulb}
        className="flex items-center gap-2.5 rounded-full border border-white/10 bg-rauch px-4 py-1.5 text-sm text-asche transition-colors hover:border-white/20 hover:text-porzellan"
      >
        <span
          aria-hidden
          className={
            'size-2 rounded-full transition-all duration-300 ' +
            (bulbOn ? 'bg-bernstein shadow-[0_0_10px_2px_rgba(242,166,90,0.55)]' : 'bg-white/15')
          }
        />
        Licht {bulbOn ? 'an' : 'aus'}
      </button>
    </div>
  )
}
