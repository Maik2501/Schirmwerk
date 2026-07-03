import { Scene } from './viewport/Scene'
import { useStudio } from './state/store'

/**
 * App-Rahmen für Feature 1: schmale Kopfleiste, Viewport als Bühne.
 * Das Parameter-Panel (Feature 2) bekommt später die rechte Seite.
 */
export default function App() {
  return (
    <div className="flex h-dvh flex-col bg-kohle text-porzellan">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold tracking-[0.22em]">SCHIRMWERK</span>
          <span className="hidden text-xs text-asche sm:inline">
            Lampenschirm-Generator · Vase-Mode
          </span>
        </div>
        <BulbToggle />
      </header>

      <main className="relative flex-1">
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
        <p className="pointer-events-none absolute bottom-3 left-5 font-mono text-[11px] text-asche/70">
          Ziehen: drehen · Scrollen: zoomen · Rechte Maustaste: verschieben
        </p>
      </main>
    </div>
  )
}

function BulbToggle() {
  const bulbOn = useStudio((s) => s.bulbOn)
  const toggleBulb = useStudio((s) => s.toggleBulb)
  return (
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
  )
}
