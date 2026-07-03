/**
 * Parameter-Panel: der Riss oben, darunter die einklappbaren Gruppen
 * Form / Wellen / Fassung / Export. Alle Werte sind aus Nutzersicht
 * beschriftet (Durchmesser statt Radius, Prozent statt Faktor) –
 * die Umrechnung in die Geometrie-Parameter passiert genau hier.
 */
import { SOCKETS } from '../geometry/sockets'
import type { ProfilePreset, SocketType } from '../geometry/types'
import { useStudio } from '../state/store'
import { Group } from './Group'
import { Riss } from './Riss'
import { SliderInput } from './SliderInput'

const PROFILE_PRESETS: { id: ProfilePreset; label: string }[] = [
  { id: 'zylinder', label: 'Zylinder' },
  { id: 'konus', label: 'Konus' },
  { id: 'tropfen', label: 'Tropfen' },
  { id: 'glocke', label: 'Glocke' },
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
  const { setParams, setProfile, setWaves, setNeck, setPreviewRes, setExportRes } = useStudio()

  const { profile, waves, neck } = params
  const shapeless = profile.preset === 'zylinder' || profile.preset === 'konus'

  return (
    <div className="flex h-full flex-col">
      <Riss />
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <Group title="Form">
          <div>
            <span className="mb-1.5 block text-xs text-asche">Grundprofil</span>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-kohle p-1">
              {PROFILE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={profile.preset === p.id}
                  onClick={() => setProfile({ preset: p.id })}
                  className={
                    'rounded px-1 py-1 text-[11px] transition-colors ' +
                    (profile.preset === p.id
                      ? 'bg-rauch text-bernstein'
                      : 'text-asche hover:text-porzellan')
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
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
            label="Wellen-Auslauf unten"
            value={params.footBlendMm}
            min={0}
            max={30}
            step={1}
            unit="mm"
            onChange={(v) => setParams({ footBlendMm: v })}
          />
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

        <Group title="Export" defaultOpen={false}>
          <p className="text-[11px] leading-relaxed text-asche">
            Vorschau- und Export-Auflösung sind getrennt – der STL-Export
            (nächstes Feature) rechnet immer mit der Export-Auflösung.
          </p>
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
