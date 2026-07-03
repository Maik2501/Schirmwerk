/**
 * Signature-Element „Der Riss“: technischer Live-Seitenriss des Schirms.
 *
 * Gezeichnet werden die äußere Hüllkurve (max. Radius je Höhe, Bernstein)
 * und die innere Hüllkurve (min. Radius, gedämpft) – so sieht man Profil
 * UND Wellentiefe auf einen Blick, in echten Millimeter-Proportionen.
 * Ab Feature 4 färben sich hier Zonen mit kritischem Überhang signalrot,
 * nach dem MVP wird der Riss zum Bezier-Editor.
 */
import { useMemo } from 'react'
import { radiusAt, TWO_PI } from '../geometry/surface'
import { useStudio } from '../state/store'

const ROWS = 96
const THETA_SAMPLES = 128

export function Riss() {
  const params = useStudio((s) => s.params)

  const { outer, inner, maxR } = useMemo(() => {
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
    return { outer, inner, maxR }
  }, [params])

  const H = params.heightMm
  const pad = 8
  const topR = outer[outer.length - 1][0]

  const poly = (pts: [number, number][], sign: 1 | -1) =>
    pts.map(([r, z]) => `${(sign * r).toFixed(2)},${z.toFixed(2)}`).join(' ')

  return (
    <figure className="border-b border-white/5 px-4 py-3">
      <svg
        viewBox={`${-maxR - pad} ${-pad} ${2 * (maxR + pad)} ${H + 2 * pad}`}
        className="mx-auto h-36 w-full"
        role="img"
        aria-label={`Seitenriss: Höhe ${H.toFixed(0)} mm, größter Durchmesser ${(2 * maxR).toFixed(0)} mm`}
      >
        {/* SVG-y zeigt nach unten, Modell-z nach oben → spiegeln */}
        <g transform={`scale(1,-1) translate(0,${-H})`}>
          {/* Mittelachse + Druckbett */}
          <line x1={0} y1={-2} x2={0} y2={H + 2} stroke="var(--color-asche)" strokeOpacity={0.25} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <line x1={-maxR - 4} y1={0} x2={maxR + 4} y2={0} stroke="var(--color-asche)" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          {/* innere Hüllkurve (Wellentäler) */}
          <polyline points={poly(inner, 1)} fill="none" stroke="var(--color-asche)" strokeOpacity={0.45} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <polyline points={poly(inner, -1)} fill="none" stroke="var(--color-asche)" strokeOpacity={0.45} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {/* äußere Silhouette (Wellenberge) */}
          <polyline points={poly(outer, 1)} fill="none" stroke="var(--color-bernstein)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polyline points={poly(outer, -1)} fill="none" stroke="var(--color-bernstein)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {/* obere Kante (Halsöffnung) */}
          <line x1={-topR} y1={H} x2={topR} y2={H} stroke="var(--color-bernstein)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <figcaption className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] text-asche">
        <span>Seitenriss</span>
        <span>
          H {H.toFixed(0)} · Ø max {(2 * maxR).toFixed(0)} mm
        </span>
      </figcaption>
    </figure>
  )
}
