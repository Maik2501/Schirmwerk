/**
 * Parameter-Panel: der Riss oben, darunter die einklappbaren Gruppen
 * Form / Wellen / Fassung / Export. Alle Werte sind aus Nutzersicht
 * beschriftet (Durchmesser statt Radius, Prozent statt Faktor) –
 * die Umrechnung in die Geometrie-Parameter passiert genau hier.
 */
import { useMemo, useState } from 'react'
import { estimateVasePrint } from '../geometry/printEstimate'
import { SOCKETS } from '../geometry/sockets'
import { sampleMinRadius } from '../geometry/surface'
import { stlByteLength } from '../geometry/stl'
import type { ProfileMode, ProfilePreset, ShadeParams, SocketType, Waveform } from '../geometry/types'
import { PETG_TRANSLUCENT } from '../state/filaments'
import { useStudio } from '../state/store'
import { downloadModel, modelFileName, type ExportFormat } from './exportStl'
import { Group } from './Group'
import { Riss } from './Riss'
import { SliderInput } from './SliderInput'

const PROFILE_PRESETS: { id: ProfilePreset; label: string }[] = [
  { id: 'zylinder', label: 'Zylinder' },
  { id: 'konus', label: 'Konus' },
  { id: 'tropfen', label: 'Tropfen' },
  { id: 'glocke', label: 'Glocke' },
  { id: 'saeule', label: 'Säule' },
]

const MOUNTINGS: { id: 'haengend' | 'stehend'; label: string }[] = [
  { id: 'haengend', label: 'Hängend (Pendel)' },
  { id: 'stehend', label: 'Stehend (Fuß)' },
]

/**
 * Vase-Schätzung als eigene Komponente: rechnet nur, wenn die
 * Export-Gruppe offen ist (Group unmountet zugeklappte Inhalte).
 */
function PrintEstimateLine({ params }: { params: ShadeParams }) {
  const est = useMemo(() => estimateVasePrint(params), [params])
  const h = Math.floor(est.minutes / 60)
  const m = Math.round(est.minutes % 60)
  return (
    <p className="mt-1 font-mono text-[10px] text-asche">
      Vase-Schätzung: ≈ {est.lengthM.toFixed(0)} m Bahn · {est.grams.toFixed(0)} g PETG · ~
      {h}:{String(m).padStart(2, '0')} h
    </p>
  )
}

const WAVEFORMS: { id: Waveform; label: string }[] = [
  { id: 'sinus', label: 'Sinus' },
  { id: 'dreieck', label: 'Dreieck' },
  { id: 'saegezahn', label: 'Sägezahn' },
  { id: 'superformula', label: 'Superformel' },
]

const CUSTOM_MODES: { id: Exclude<ProfileMode, 'preset'>; label: string }[] = [
  { id: 'bezier', label: 'Bezier-Kurve' },
  { id: 'spline', label: 'Spline-Punkte' },
]

const SOCKET_OPTIONS: { id: SocketType; label: string }[] = [
  { id: 'e27', label: 'E27' },
  { id: 'e14', label: 'E14' },
  { id: 'custom', label: 'Frei' },
]

export function Panel() {
  const params = useStudio((s) => s.params)
  const previewRes = useStudio((s) => s.previewRes)
  const exportRes = useStudio((s) => s.exportRes)
  const shadeColor = useStudio((s) => s.shadeColor)
  const mounting = useStudio((s) => s.mounting)
  const layerLines = useStudio((s) => s.layerLines)
  const glassPreview = useStudio((s) => s.glassPreview)
  const {
    setParams,
    setProfile,
    setProfileMode,
    setWaves,
    setNeck,
    setPreviewRes,
    setExportRes,
    setShadeColor,
    setMounting,
    toggleLayerLines,
    toggleGlassPreview,
  } = useStudio()

  const { profile, waves, neck } = params
  const editing = profile.mode !== 'preset'
  // Bauch-Regler wirkt nur auf Presets mit Formanteil
  const shapeless = editing || profile.preset === 'zylinder' || profile.preset === 'konus'

  // --- Export ---------------------------------------------------------
  const [exportBusy, setExportBusy] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('stl')
  // Selbstschnitt-Wächter: r ≤ 0 ⇒ Polarkontur schneidet sich, Export sperren.
  // 128² Proben reichen (n2 ≤ 48 ⇒ über Nyquist) und bleiben beim Reglerziehen flüssig.
  const selfIntersecting = useMemo(
    () => sampleMinRadius(params, { thetaSegments: 128, zSegments: 128 }) <= 0,
    [params],
  )
  const exportTris = 2 * exportRes.thetaSegments * exportRes.zSegments + 2 * exportRes.thetaSegments
  const exportMb = stlByteLength(exportTris) / 1_048_576

  const handleExport = () => {
    if (exportBusy || selfIntersecting) return
    setExportBusy(true)
    // erst den Busy-Zustand rendern lassen, dann rechnen
    setTimeout(async () => {
      try {
        await downloadModel(params, exportRes, exportFormat)
      } finally {
        setExportBusy(false)
      }
    }, 30)
  }

  return (
    <div className="flex h-full flex-col">
      <Riss />
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <Group title="Aufbau">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-kohle p-1">
            {MOUNTINGS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mounting === m.id}
                onClick={() => setMounting(m.id)}
                className={
                  'rounded px-1 py-1 text-[11px] transition-colors ' +
                  (mounting === m.id ? 'bg-rauch text-bernstein' : 'text-asche hover:text-porzellan')
                }
              >
                {m.label}
              </button>
            ))}
          </div>
          {mounting === 'stehend' && (
            <div>
              <span className="mb-1.5 block text-xs text-asche">Druckrichtung</span>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-kohle p-1">
                <button
                  type="button"
                  aria-pressed={params.neckPosition === 'top'}
                  onClick={() => setParams({ neckPosition: 'top' })}
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (params.neckPosition === 'top'
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  Öffnung am Bett
                </button>
                <button
                  type="button"
                  aria-pressed={params.neckPosition === 'bottom'}
                  onClick={() => setParams({ neckPosition: 'bottom' })}
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (params.neckPosition === 'bottom'
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  Kragen am Bett
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-asche">
                {params.neckPosition === 'top'
                  ? 'Kopfüber gedruckt (beste Haftung), zum Nutzen umgedreht.'
                  : 'Direkt in Nutzlage gedruckt – kleine Auflagefläche, Brim empfohlen. Die Oberkante darf frei auslaufen.'}
              </p>
            </div>
          )}
        </Group>

        <Group title="Form">
          <div>
            <span className="mb-1.5 block text-xs text-asche">Grundprofil</span>
            <div className="grid grid-cols-5 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {PROFILE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={!editing && profile.preset === p.id}
                  onClick={() => setProfile({ preset: p.id, mode: 'preset' })}
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (!editing && profile.preset === p.id
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {CUSTOM_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={profile.mode === m.id}
                  onClick={() => setProfileMode(m.id)}
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (profile.mode === m.id
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
            {editing && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-asche">
                Freie Form übernimmt die aktuelle Kurve – oben im Riss ziehen.
              </p>
            )}
          </div>
          <SliderInput
            label="Höhe"
            value={params.heightMm}
            min={60}
            max={250}
            step={1}
            unit="mm"
            onChange={(v) => setParams({ heightMm: v })}
          />
          <SliderInput
            label="Durchmesser unten"
            value={profile.bottomRadiusMm * 2}
            min={30}
            max={240}
            step={1}
            unit="mm"
            onChange={(v) => setProfile({ bottomRadiusMm: v / 2 })}
          />
          <SliderInput
            label="Durchmesser oben (vor Hals)"
            value={profile.topRadiusMm * 2}
            min={20}
            max={240}
            step={1}
            unit="mm"
            onChange={(v) => setProfile({ topRadiusMm: v / 2 })}
          />
          <SliderInput
            label="Bauch / Ausprägung"
            value={profile.shapeAmount * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            disabled={shapeless}
            onChange={(v) => setProfile({ shapeAmount: v / 100 })}
          />
        </Group>

        <Group title="Wellen">
          <div>
            <span className="mb-1.5 block text-xs text-asche">Wellenform</span>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {WAVEFORMS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={waves.waveform === w.id}
                  onClick={() => setWaves({ waveform: w.id })}
                  className={
                    'rounded px-0.5 py-1 text-[10px] transition-colors ' +
                    (waves.waveform === w.id
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <SliderInput
            label="Wellen pro Umdrehung"
            value={waves.n1}
            min={1}
            max={24}
            step={1}
            onChange={(v) => setWaves({ n1: Math.round(v) })}
          />
          <SliderInput
            label="Wellentiefe"
            value={waves.a1 * 100}
            min={0}
            max={40}
            step={0.5}
            unit="%"
            onChange={(v) => setWaves({ a1: v / 100 })}
          />
          <SliderInput
            label="Verdrehung (Twist)"
            value={waves.twistDeg}
            min={-360}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => setWaves({ twistDeg: v })}
          />
          <SliderInput
            label="Feinwellen pro Umdrehung"
            value={waves.n2}
            min={2}
            max={48}
            step={1}
            onChange={(v) => setWaves({ n2: Math.round(v) })}
          />
          <SliderInput
            label="Feinwellen-Tiefe"
            value={waves.a2 * 100}
            min={0}
            max={15}
            step={0.5}
            unit="%"
            onChange={(v) => setWaves({ a2: v / 100 })}
          />
          <SliderInput
            label={params.neckPosition === 'bottom' ? 'Wellen-Auslauf oben' : 'Wellen-Auslauf unten'}
            value={params.footBlendMm}
            min={0}
            max={30}
            step={1}
            unit="mm"
            onChange={(v) => setParams({ footBlendMm: v })}
          />
          <button
            type="button"
            onClick={() =>
              // verschiebt nur die Phasenlagen – gleiche Parameter, neues
              // Interferenzmuster von Haupt- und Feinwellen
              setWaves({
                phase1Rad: Math.random() * 2 * Math.PI,
                phase2Rad: Math.random() * 2 * Math.PI,
              })
            }
            className="w-full rounded-md border border-white/10 px-3 py-1.5 text-xs text-asche transition-colors hover:border-white/25 hover:text-porzellan"
          >
            Variante würfeln ⚄
          </button>
        </Group>

        <Group title="Fassung" defaultOpen={false}>
          <div>
            <span className="mb-1.5 block text-xs text-asche">Fassung</span>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {SOCKET_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={neck.socket === o.id}
                  onClick={() =>
                    setNeck(
                      o.id === 'custom'
                        ? { socket: o.id }
                        : { socket: o.id, holeDiameterMm: SOCKETS[o.id].holeDiameterMm },
                    )
                  }
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (neck.socket === o.id
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <SliderInput
            label="Lochdurchmesser"
            value={neck.holeDiameterMm}
            min={20}
            max={60}
            step={0.5}
            unit="mm"
            onChange={(v) => setNeck({ holeDiameterMm: v, socket: 'custom' })}
          />
          <SliderInput
            label="Toleranz (aufs Loch)"
            value={neck.extraClearanceMm}
            min={0}
            max={1.5}
            step={0.05}
            unit="mm"
            onChange={(v) => setNeck({ extraClearanceMm: v })}
          />
          <SliderInput
            label="Kragenhöhe"
            value={neck.heightMm}
            min={4}
            max={40}
            step={1}
            unit="mm"
            onChange={(v) => setNeck({ heightMm: v })}
          />
          <SliderInput
            label="Übergangszone zum Kragen"
            value={neck.blendMm}
            min={5}
            max={60}
            step={1}
            unit="mm"
            onChange={(v) => setNeck({ blendMm: v })}
          />
        </Group>

        <Group title="Material">
          <div>
            <span className="mb-1.5 block text-xs text-asche">
              Farbe (Bambu PETG Translucent)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PETG_TRANSLUCENT.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={f.name}
                  aria-pressed={shadeColor.id === f.id}
                  title={f.name}
                  onClick={() => setShadeColor(f)}
                  className={
                    'size-7 rounded-full border transition-transform ' +
                    (shadeColor.id === f.id
                      ? 'scale-110 border-bernstein ring-2 ring-bernstein/35'
                      : 'border-white/15 hover:scale-105 hover:border-white/40')
                  }
                  style={{
                    // „Klar“ bekommt einen Glas-Verlauf statt Vollton
                    background:
                      f.id === 'clear'
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.15))'
                        : f.hex,
                  }}
                />
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-asche">
              {shadeColor.name}
              {shadeColor.id !== 'clear' && ` · ${shadeColor.hex.toUpperCase()}`}
              {` · ≈${Math.round(shadeColor.td * 100)} % Licht`}
            </p>
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-asche">Vorschau-Optik</span>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              <button
                type="button"
                aria-pressed={layerLines}
                onClick={toggleLayerLines}
                className={
                  'rounded px-1 py-1 text-[11px] transition-colors ' +
                  (layerLines ? 'bg-rauch text-bernstein' : 'text-asche hover:text-porzellan')
                }
              >
                Layerlinien
              </button>
              <button
                type="button"
                aria-pressed={glassPreview}
                onClick={toggleGlassPreview}
                className={
                  'rounded px-1 py-1 text-[11px] transition-colors ' +
                  (glassPreview ? 'bg-rauch text-bernstein' : 'text-asche hover:text-porzellan')
                }
              >
                Glas-Vorschau
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-asche">
              Glas-Vorschau rendert echte Brechung – sichtbar schöner, spürbar
              GPU-lastiger. Durchlässigkeit je Farbe ist eine Schätzung.
            </p>
          </div>
        </Group>

        <Group title="Export" defaultOpen={false}>
          <p className="text-[11px] leading-relaxed text-asche">
            Das STL kommt absichtlich als gefüllter Solid – erst der
            Vase-Modus des Slicers macht daraus die einwandige Spirale.
            Bambu Studio: Prozess → Sonstiges → <em className="text-porzellan/80 not-italic">Spiralvase</em>{' '}
            aktivieren, dann Stärke → <em className="text-porzellan/80 not-italic">Boden-Schalenschichten = 0</em>{' '}
            (öffnet die Unterseite; oben endet die Spirale von selbst offen).
          </p>
          <div>
            <div className="mb-1.5 grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {(['stl', '3mf'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={exportFormat === f}
                  onClick={() => setExportFormat(f)}
                  className={
                    'rounded px-1 py-1 text-[11px] uppercase transition-colors ' +
                    (exportFormat === f ? 'bg-rauch text-bernstein' : 'text-asche hover:text-porzellan')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportBusy || selfIntersecting}
              className="w-full rounded-md border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-sm text-bernstein transition-colors hover:bg-bernstein/20 disabled:pointer-events-none disabled:opacity-40"
            >
              {exportBusy ? 'Rechne …' : `${exportFormat.toUpperCase()} exportieren`}
            </button>
            {selfIntersecting ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-signal">
                Export gesperrt: Radius fällt auf ≤ 0 mm, die Form schneidet
                sich selbst. Wellentiefe verringern oder Profil anpassen.
              </p>
            ) : (
              <p className="mt-1.5 font-mono text-[10px] text-asche">
                {modelFileName(params, exportFormat)} · {exportTris.toLocaleString('de-DE')} Dreiecke
                {exportFormat === 'stl' &&
                  ` · ${exportMb.toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`}
              </p>
            )}
            <PrintEstimateLine params={params} />
          </div>
          <SliderInput
            label="Vorschau: Segmente Umfang"
            value={previewRes.thetaSegments}
            min={48}
            max={320}
            step={8}
            onChange={(v) => setPreviewRes({ thetaSegments: Math.round(v) })}
          />
          <SliderInput
            label="Vorschau: Segmente Höhe"
            value={previewRes.zSegments}
            min={40}
            max={400}
            step={10}
            onChange={(v) => setPreviewRes({ zSegments: Math.round(v) })}
          />
          <SliderInput
            label="Export: Segmente Umfang"
            value={exportRes.thetaSegments}
            min={128}
            max={1024}
            step={32}
            onChange={(v) => setExportRes({ thetaSegments: Math.round(v) })}
          />
          <SliderInput
            label="Export: Segmente Höhe"
            value={exportRes.zSegments}
            min={100}
            max={2000}
            step={50}
            onChange={(v) => setExportRes({ zSegments: Math.round(v) })}
          />
        </Group>
      </div>
    </div>
  )
}
