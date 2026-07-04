/**
 * Signature-Element „Der Riss“: technischer Live-Seitenriss des Schirms.
 *
 * Im Preset-Modus reine Anzeige: äußere Hüllkurve (max. Radius je Höhe,
 * Bernstein) und innere Hüllkurve (min. Radius, gedämpft) zeigen Profil UND
 * Wellentiefe auf einen Blick, in echten Millimeter-Proportionen.
 *
 * In den freien Modi wird der Riss zum Editor: er wächst auf doppelte Höhe
 * und zeigt die rohe Profilkurve P(z) mit ziehbaren Punkten – Bezier-Griffe
 * (inkl. Kontrollpolygon) bzw. Spline-Stützpunkte (Klick auf die Kurve fügt
 * hinzu, Doppelklick löscht). Die Endpunkte unten/oben sind horizontal
 * ziehbar und koppeln direkt an die Durchmesser-Regler im Panel.
 *
 * Interaktions-Details:
 * - Während eines Drags wird die viewBox eingefroren, sonst liefe die Skala
 *   unter dem Zeiger weg (Radius wächst → Ansicht zoomt raus → Punkt
 *   springt) – eine Rückkopplung, die Präzision unmöglich macht.
 * - Punktgrößen sind in Pixeln gedacht und werden über den gemessenen
 *   px/mm-Maßstab in SVG-Einheiten umgerechnet (Touch-Ziele ≥ 32 px).
 * - Mit dem Druckbarkeits-Check färben sich hier später Zonen mit
 *   kritischem Überhang signalrot.
 */
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { evalProfile } from '../geometry/profile'
import {
  clamp,
  OVERHANG_LIMIT_DEG,
  radiusAt,
  silhouetteOverhangProfile,
  TWO_PI,
} from '../geometry/surface'
import { useStudio } from '../state/store'

const ROWS = 96
const THETA_SAMPLES = 128
/** Mindestabstand zweier Spline-Punkte in t (normierte Höhe) */
const T_GAP = 0.02
/** P1S-Bauraum (Würfelkante), nur Hinweis – wir begrenzen nicht hart */
const BUILD_VOLUME_MM = 256

type DragTarget =
  | { kind: 'end'; which: 'bottom' | 'top' }
  | { kind: 'handle'; which: 1 | 2 }
  | { kind: 'point'; index: number }

export function Riss() {
  const params = useStudio((s) => s.params)
  const setProfile = useStudio((s) => s.setProfile)
  const mounting = useStudio((s) => s.mounting)

  const profile = params.profile
  const H = params.heightMm
  const editing = profile.mode !== 'preset'

  const { outer, inner, maxR, overhang } = useMemo(() => {
    const outer: [number, number][] = []
    const inner: [number, number][] = []
    let maxR = 0
    for (let i = 0; i <= ROWS; i++) {
      const z = (i / ROWS) * params.heightMm
      let lo = Infinity
      let hi = -Infinity
      for (let j = 0; j < THETA_SAMPLES; j++) {
        const r = radiusAt(params, (j / THETA_SAMPLES) * TWO_PI, z)
        if (r < lo) lo = r
        if (r > hi) hi = r
      }
      outer.push([hi, z])
      inner.push([lo, z])
      if (hi > maxR) maxR = hi
    }
    // Silhouetten-Überhang direkt aus der Hüllkurve (keine neuen Samples)
    const overhang = silhouetteOverhangProfile(outer)
    return { outer, inner, maxR, overhang }
  }, [params])

  // Kritische Höhenzonen als zusammenhängende Läufe für die rote Markierung
  const criticalRuns = useMemo(() => {
    const runs: [number, number][] = [] // [startRow, endRow] inklusiv
    let start = -1
    for (let i = 0; i <= ROWS; i++) {
      const critical = overhang.perRowDeg[i] > OVERHANG_LIMIT_DEG
      if (critical && start < 0) start = i
      if (!critical && start >= 0) {
        runs.push([start, i - 1])
        start = -1
      }
    }
    if (start >= 0) runs.push([start, ROWS])
    // Einzelreihen auf mindestens ein Segment verlängern (sonst unsichtbar)
    return runs.map(([a, b]) => (a === b ? [Math.max(0, a - 1), Math.min(ROWS, b + 1)] : [a, b]))
  }, [overhang])

  // Rohe Profilkurve P(z) – das editierbare Rückgrat (ohne Wellen/Blends)
  const spine = useMemo(() => {
    if (!editing) return null
    const pts: [number, number][] = []
    for (let i = 0; i <= ROWS; i++) {
      const t = i / ROWS
      pts.push([evalProfile(profile, t), t * H])
    }
    return pts
  }, [editing, profile, H])

  // Sichtradius: Hüllkurve plus alles Editierbare (Griffe können außerhalb
  // der Kurve liegen und sollen nie aus dem Bild fallen)
  const viewR = useMemo(() => {
    let m = maxR
    if (spine) for (const [r] of spine) m = Math.max(m, r)
    if (editing && profile.mode === 'bezier') {
      m = Math.max(m, profile.bezier.r1Mm, profile.bezier.r2Mm)
    }
    if (editing && profile.mode === 'spline') {
      for (const p of profile.spline) m = Math.max(m, p.rMm)
    }
    return m
  }, [maxR, spine, editing, profile])

  const pad = 8
  const vbString = `${-viewR - pad} ${-pad} ${2 * (viewR + pad)} ${H + 2 * pad}`

  // ---- Drag-Infrastruktur ------------------------------------------------

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragTarget | null>(null)
  const frozenVbRef = useRef<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const viewBox = dragging && frozenVbRef.current ? frozenVbRef.current : vbString

  // px-pro-mm-Maßstab messen, damit Punkt- und Touchgrößen in Pixeln stimmen
  const [pxPerMm, setPxPerMm] = useState(1.4)
  const measure = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const v = svg.viewBox.baseVal
    if (rect.width === 0 || v.width === 0) return
    const s = Math.min(rect.width / v.width, rect.height / v.height)
    setPxPerMm((prev) => (Math.abs(prev - s) > 1e-3 ? s : prev))
  }, [])
  useLayoutEffect(() => {
    // nach jedem Render – viewBox und Elementhöhe können sich geändert haben
    measure()
  })
  useLayoutEffect(() => {
    const ro = new ResizeObserver(measure)
    if (svgRef.current) ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [measure])

  /** Client-Koordinaten → Modellraum: x in mm (Vorzeichen = Seite), z in mm. */
  const toModel = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const v = svg.viewBox.baseVal
    const s = Math.min(rect.width / v.width, rect.height / v.height)
    const ox = (rect.width - v.width * s) / 2
    const oy = (rect.height - v.height * s) / 2
    const x = v.x + (e.clientX - rect.left - ox) / s
    const y = v.y + (e.clientY - rect.top - oy) / s
    // Das Zeichen-g spiegelt die y-Achse (Modell-z nach oben): z = H − y
    return { x, z: H - y }
  }

  /** Pointer ans SVG binden; kann werfen, wenn der Pointer schon weg ist. */
  const capturePointer = (pointerId: number) => {
    try {
      svgRef.current?.setPointerCapture(pointerId)
    } catch {
      // Drag läuft dann ohne Capture – Move-Events kommen weiter, solange
      // der Zeiger über dem SVG bleibt.
    }
  }

  const beginDrag = (target: DragTarget) => (e: ReactPointerEvent<SVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    capturePointer(e.pointerId)
    dragRef.current = target
    frozenVbRef.current = vbString
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const target = dragRef.current
    if (!target) return
    e.preventDefault()
    const { x, z } = toModel(e)
    // beide Spiegelseiten greifen; Radius nie unter 1 mm (r > 0-Kriterium)
    const r = Math.max(1, Math.abs(x))

    if (target.kind === 'end') {
      setProfile(target.which === 'bottom' ? { bottomRadiusMm: r } : { topRadiusMm: r })
    } else if (target.kind === 'handle') {
      const t = clamp(z / H, 0, 1)
      const b = { ...profile.bezier }
      if (target.which === 1) {
        b.r1Mm = r
        b.t1 = Math.min(t, b.t2) // Invariante t1 ≤ t2: Höhe bleibt monoton
      } else {
        b.r2Mm = r
        b.t2 = Math.max(t, b.t1)
      }
      setProfile({ bezier: b })
    } else {
      const pts = profile.spline.map((p) => ({ ...p }))
      const lo = (target.index === 0 ? 0 : pts[target.index - 1].t) + T_GAP
      const hi = (target.index === pts.length - 1 ? 1 : pts[target.index + 1].t) - T_GAP
      pts[target.index] = { rMm: r, t: clamp(z / H, lo, hi) }
      setProfile({ spline: pts })
    }
  }

  const endDrag = () => {
    dragRef.current = null
    frozenVbRef.current = null
    setDragging(false)
  }

  /** Klick auf freie Fläche nahe der Kurve fügt einen Spline-Punkt ein. */
  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (profile.mode !== 'spline') return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const { x, z } = toModel(e)
    const t = z / H
    if (t < T_GAP || t > 1 - T_GAP) return
    if (profile.spline.some((p) => Math.abs(p.t - t) < T_GAP)) return
    // nur in Kurvennähe (±20 px), sonst produziert jeder Fehlklick Punkte
    if (Math.abs(Math.abs(x) - evalProfile(profile, t)) > 20 / pxPerMm) return

    const neu = { rMm: Math.max(1, Math.abs(x)), t }
    const pts = [...profile.spline.map((p) => ({ ...p })), neu].sort((a, b) => a.t - b.t)
    setProfile({ spline: pts })
    // frisch gesetzten Punkt direkt greifen
    capturePointer(e.pointerId)
    dragRef.current = { kind: 'point', index: pts.indexOf(neu) }
    frozenVbRef.current = vbString
    setDragging(true)
  }

  const removePoint = (index: number) => () => {
    setProfile({ spline: profile.spline.filter((_, i) => i !== index) })
  }

  // ---- Tastatur (A11y): Pfeile verschieben, Shift = fein, Entf löscht ----

  /** Punkt um (Δr, Δz) in mm verschieben – gleiche Klemmen wie beim Drag. */
  const nudge = (target: DragTarget, drMm: number, dzMm: number) => {
    if (target.kind === 'end') {
      const cur = target.which === 'bottom' ? profile.bottomRadiusMm : profile.topRadiusMm
      const next = Math.max(1, cur + drMm)
      setProfile(target.which === 'bottom' ? { bottomRadiusMm: next } : { topRadiusMm: next })
    } else if (target.kind === 'handle') {
      const b = { ...profile.bezier }
      const dt = dzMm / H
      if (target.which === 1) {
        b.r1Mm = Math.max(1, b.r1Mm + drMm)
        b.t1 = clamp(b.t1 + dt, 0, b.t2)
      } else {
        b.r2Mm = Math.max(1, b.r2Mm + drMm)
        b.t2 = clamp(b.t2 + dt, b.t1, 1)
      }
      setProfile({ bezier: b })
    } else {
      const pts = profile.spline.map((p) => ({ ...p }))
      const lo = (target.index === 0 ? 0 : pts[target.index - 1].t) + T_GAP
      const hi = (target.index === pts.length - 1 ? 1 : pts[target.index + 1].t) - T_GAP
      const p = pts[target.index]
      pts[target.index] = { rMm: Math.max(1, p.rMm + drMm), t: clamp(p.t + dzMm / H, lo, hi) }
      setProfile({ spline: pts })
    }
  }

  const onGripKeyDown = (target: DragTarget) => (e: ReactKeyboardEvent<SVGElement>) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && target.kind === 'point') {
      e.preventDefault()
      removePoint(target.index)()
      return
    }
    const step = e.shiftKey ? 0.2 : 1
    let dr = 0
    let dz = 0
    if (e.key === 'ArrowLeft') dr = -step
    else if (e.key === 'ArrowRight') dr = step
    else if (e.key === 'ArrowUp') dz = step
    else if (e.key === 'ArrowDown') dz = -step
    else return
    if (target.kind === 'end' && dz !== 0) return // Endpunkte sind rein radial
    e.preventDefault()
    nudge(target, dr, dz)
  }

  // ---- Darstellung ---------------------------------------------------------

  const topR = outer[outer.length - 1][0]
  const poly = (pts: [number, number][], sign: 1 | -1) =>
    pts.map(([r, z]) => `${(sign * r).toFixed(2)},${z.toFixed(2)}`).join(' ')

  // Punktgrößen in mm, aus Pixel-Wunschgrößen zurückgerechnet
  const dotR = 5 / pxPerMm
  const hitR = 16 / pxPerMm
  const sqR = 4 / pxPerMm

  const bez = profile.bezier
  const bezierPts: [number, number][] = [
    [profile.bottomRadiusMm, 0],
    [bez.r1Mm, bez.t1 * H],
    [bez.r2Mm, bez.t2 * H],
    [profile.topRadiusMm, H],
  ]
  const splinePts: [number, number][] = profile.spline.map((p) => [p.rMm, p.t * H])

  /**
   * Ziehbarer Punkt mit unsichtbarer, touch-tauglicher Trefferfläche –
   * per Tab fokussierbar und mit Pfeiltasten steuerbar (Shift = 0,2 mm).
   */
  const grip = (
    key: string,
    [r, z]: [number, number],
    target: DragTarget,
    opts?: { square?: boolean; onDouble?: () => void; label?: string },
  ) => (
    <g key={key} className="cursor-grab active:cursor-grabbing">
      {opts?.square ? (
        <rect
          x={r - sqR}
          y={z - sqR}
          width={2 * sqR}
          height={2 * sqR}
          fill="var(--color-kohle)"
          stroke="var(--color-bernstein)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <circle
          cx={r}
          cy={z}
          r={dotR}
          fill="var(--color-kohle)"
          stroke="var(--color-bernstein)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle
        cx={r}
        cy={z}
        r={hitR}
        fill="transparent"
        style={{ pointerEvents: 'all' }}
        tabIndex={0}
        role="button"
        aria-label={
          (opts?.label ?? 'Kurvenpunkt') +
          ` – r ${r.toFixed(1)} mm, Höhe ${z.toFixed(1)} mm. Pfeiltasten verschieben, Shift = fein` +
          (target.kind === 'point' ? ', Entf löscht' : '')
        }
        onPointerDown={beginDrag(target)}
        onDoubleClick={opts?.onDouble}
        onKeyDown={onGripKeyDown(target)}
      />
    </g>
  )

  return (
    <figure className="border-b border-white/5 px-4 py-3 select-none">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={
          'mx-auto w-full transition-[height] duration-300 ' + (editing ? 'h-72' : 'h-36')
        }
        style={{ touchAction: editing ? 'none' : undefined }}
        role="img"
        aria-label={
          `Seitenriss: Höhe ${H.toFixed(0)} mm, größter Durchmesser ${(2 * maxR).toFixed(0)} mm` +
          (editing ? ' – Profilkurve mit ziehbaren Punkten' : '')
        }
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        {/* SVG-y zeigt nach unten, Modell-z nach oben → spiegeln */}
        <g transform={`scale(1,-1) translate(0,${-H})`}>
          {/* Mittelachse + Druckbett */}
          <line x1={0} y1={-2} x2={0} y2={H + 2} stroke="var(--color-asche)" strokeOpacity={0.25} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <line x1={-viewR - 4} y1={0} x2={viewR + 4} y2={0} stroke="var(--color-asche)" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          {/* innere Hüllkurve (Wellentäler) */}
          <polyline points={poly(inner, 1)} fill="none" stroke="var(--color-asche)" strokeOpacity={editing ? 0.25 : 0.45} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <polyline points={poly(inner, -1)} fill="none" stroke="var(--color-asche)" strokeOpacity={editing ? 0.25 : 0.45} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {/* äußere Silhouette (Wellenberge) – beim Editieren nur Kontext */}
          <polyline points={poly(outer, 1)} fill="none" stroke="var(--color-bernstein)" strokeOpacity={editing ? 0.3 : 1} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polyline points={poly(outer, -1)} fill="none" stroke="var(--color-bernstein)" strokeOpacity={editing ? 0.3 : 1} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {/* obere Kante (Halsöffnung) */}
          <line x1={-topR} y1={H} x2={topR} y2={H} stroke="var(--color-bernstein)" strokeOpacity={editing ? 0.3 : 1} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

          {/* Druckbarkeits-Check: Zonen mit Überhang über der Vase-Mode-Grenze */}
          {criticalRuns.map(([a, b]) => (
            <g key={`oh-${a}`}>
              <polyline points={poly(outer.slice(a, b + 1), 1)} fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <polyline points={poly(outer.slice(a, b + 1), -1)} fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          ))}

          {editing && spine && (
            <>
              {/* editierbare Profilkurve: rechts das Original, links der Spiegel */}
              <polyline points={poly(spine, -1)} fill="none" stroke="var(--color-bernstein)" strokeOpacity={0.25} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <polyline points={poly(spine, 1)} fill="none" stroke="var(--color-bernstein)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />

              {profile.mode === 'bezier' && (
                <polyline
                  points={poly(bezierPts, 1)}
                  fill="none"
                  stroke="var(--color-asche)"
                  strokeOpacity={0.6}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {grip('end-bottom', bezierPts[0], { kind: 'end', which: 'bottom' }, { square: true, label: 'Endpunkt unten (Durchmesser unten)' })}
              {grip('end-top', bezierPts[3], { kind: 'end', which: 'top' }, { square: true, label: 'Endpunkt oben (Durchmesser oben)' })}

              {profile.mode === 'bezier' && (
                <>
                  {grip('h1', bezierPts[1], { kind: 'handle', which: 1 }, { label: 'Bezier-Griff 1' })}
                  {grip('h2', bezierPts[2], { kind: 'handle', which: 2 }, { label: 'Bezier-Griff 2' })}
                </>
              )}
              {profile.mode === 'spline' &&
                splinePts.map((p, i) =>
                  grip(
                    `p${i}`,
                    p,
                    { kind: 'point', index: i },
                    { onDouble: removePoint(i), label: `Spline-Punkt ${i + 1} von ${splinePts.length}` },
                  ),
                )}
            </>
          )}
        </g>
      </svg>
      <figcaption className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] text-asche">
        <span>
          {profile.mode === 'preset' ? 'Seitenriss' : profile.mode === 'bezier' ? 'Bezier-Editor' : 'Spline-Editor'}
          {/* Riss zeigt immer den Druckraum – kopfüber genutzte Lampe kennzeichnen */}
          {mounting === 'stehend' && params.neckPosition === 'top' && (
            <span className="text-asche/70"> · Drucklage (Nutzung kopfüber)</span>
          )}
        </span>
        <span>
          H {H.toFixed(0)} · Ø max {(2 * maxR).toFixed(0)} mm ·{' '}
          <span className={overhang.maxDeg > OVERHANG_LIMIT_DEG ? 'text-signal' : undefined}>
            ∠ {overhang.maxDeg.toFixed(0)}°
          </span>
        </span>
      </figcaption>
      {overhang.maxDeg > OVERHANG_LIMIT_DEG && (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-signal">
          Silhouette kragt bis {overhang.maxDeg.toFixed(0)}° aus – Vase-Mode schafft
          ~{OVERHANG_LIMIT_DEG}°, rote Zonen entschärfen.
        </p>
      )}
      {(H > BUILD_VOLUME_MM || 2 * maxR > BUILD_VOLUME_MM) && (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-signal">
          Größer als der P1S-Bauraum ({BUILD_VOLUME_MM} mm Kante).
        </p>
      )}
      {editing && (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-asche/80">
          {profile.mode === 'bezier'
            ? 'Griffe ziehen · Vierecke = Durchmesser unten/oben'
            : 'Punkte ziehen · Klick auf Kurve: neuer Punkt · Doppelklick: löschen'}
          {' · Tab + Pfeile: Tastatur (Shift = fein)'}
        </p>
      )}
    </figure>
  )
}
