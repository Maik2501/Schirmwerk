/**
 * Grundprofil P(z): der Radius über die Höhe, ohne Wellen. Drei Modi:
 *
 * 1. 'preset' – kubische Bezier-Kurve im Radius-Raum:
 *
 *      P(t) = (1−t)³·r0 + 3(1−t)²t·r1 + 3(1−t)t²·r2 + t³·r3,   t = z/H ∈ [0,1]
 *
 *    r0 und r3 sind die vom Nutzer gewählten Radien unten/oben, die Presets
 *    setzen nur die beiden inneren Kontrollradien r1/r2.
 *
 * 2. 'bezier' – frei editierbare kubische Bezier-Kurve in der (r, t)-Ebene:
 *    Endpunkte (r0, 0) und (r3, 1), die inneren Kontrollpunkte tragen
 *    zusätzlich eine Höhe: (r1, t1), (r2, t2). Für 0 ≤ t1 ≤ t2 ≤ 1 ist die
 *    Höhenkomponente t(u) monoton (die Bernstein-Koeffizienten ihrer
 *    Ableitung sind t1, t2−t1, 1−t2 ≥ 0), also existiert zu jeder Höhe genau
 *    ein Kurvenparameter u – wir lösen ihn per Newton mit Bisektions-
 *    Sicherung. Liegen die Griffe auf t = 1/3 und 2/3, ist t(u) = u und die
 *    Kurve stimmt exakt mit der Preset-Form überein – der Moduswechsel
 *    startet deshalb verlustfrei aus jedem Preset.
 *
 * 3. 'spline' – kubischer Hermite-Spline r(t) mit Catmull-Rom-Tangenten
 *    durch Endpunkte und beliebig viele Stützpunkte. Als Funktion über t
 *    konstruktionsbedingt eindeutig über der Höhe, C1-glatt.
 *
 * Alle Auswertungen bleiben reine Funktionen; der Spline memoisiert seine
 * Stützstellen-Aufbereitung pro Parameter-Objekt (WeakMap), weil evalProfile
 * pro Mesh-Rebuild zehntausendfach aufgerufen wird.
 */
import type { BezierHandles, ProfileParams, SplinePoint } from './types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Kubische Bernstein-Auswertung für Skalare. */
function cubic(c0: number, c1: number, c2: number, c3: number, u: number): number {
  const v = 1 - u
  return v * v * v * c0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * c3
}

/** Ableitung der kubischen Bernstein-Form nach u. */
function cubicDeriv(c0: number, c1: number, c2: number, c3: number, u: number): number {
  const v = 1 - u
  return 3 * (v * v * (c1 - c0) + 2 * v * u * (c2 - c1) + u * u * (c3 - c2))
}

/** Liefert die vier Kontrollradien [r0, r1, r2, r3] für ein Preset. */
export function profileControlRadii(profile: ProfileParams): [number, number, number, number] {
  const { preset, bottomRadiusMm: r0, topRadiusMm: r3, shapeAmount: s } = profile
  switch (preset) {
    case 'zylinder':
    case 'konus':
      // Gerade Linie von unten nach oben; Zylinder = gleiche Radien.
      // (Beide Presets teilen sich die Kurve, sie unterscheiden sich nur
      // in den Default-Radien, die das UI setzt.)
      return [r0, lerp(r0, r3, 1 / 3), lerp(r0, r3, 2 / 3), r3]
    case 'tropfen': {
      // Bauchig/Tropfen: r1 drückt die Kurve im unteren Drittel nach außen,
      // r2 zieht sie sanft zum Hals. shapeAmount skaliert den Bauch.
      const belly = Math.max(r0, r3) * (1 + 0.9 * s)
      return [r0, belly, lerp(r0, r3, 0.7), r3]
    }
    case 'glocke': {
      // Glocke: weiter Saum unten, der schnell einzieht (konkaver Fuß),
      // oben eine leichte Schulter unterm Hals.
      const skirt = r0 * (1 - 0.55 * s)
      const shoulder = r3 * (1 + 0.35 * s)
      return [r0, skirt, shoulder, r3]
    }
  }
}

/**
 * Löst t(u) = t für die monotone Höhenkomponente (Kontrollwerte 0, t1, t2, 1).
 * Newton ab Startwert u = t (exakt bei t1 = 1/3, t2 = 2/3), fällt pro Schritt
 * auf Bisektion zurück, sobald Newton das einschließende Intervall verließe –
 * konvergiert damit auch bei entarteten Griffen (z. B. t1 = t2).
 */
function solveCurveParam(t1: number, t2: number, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = 1
  let u = t
  for (let i = 0; i < 40; i++) {
    const f = cubic(0, t1, t2, 1, u) - t
    if (Math.abs(f) < 1e-10) return u
    if (f > 0) hi = u
    else lo = u
    const d = cubicDeriv(0, t1, t2, 1, u)
    let next = d > 1e-12 ? u - f / d : Number.NaN
    if (!(next > lo && next < hi)) next = (lo + hi) / 2
    u = next
  }
  return u
}

/** Aufbereitete Spline-Stützstellen: Höhen, Radien, Tangenten (dr/dt). */
interface SplineLut {
  ts: number[]
  rs: number[]
  ms: number[]
}

// Pro Parameter-Objekt memoisiert – Params sind immutable (Zustand-Store
// erzeugt bei jeder Änderung ein neues Objekt), Identität ist also ein
// zuverlässiger Cache-Schlüssel.
const splineLutCache = new WeakMap<ProfileParams, SplineLut>()

/** Stützstellen inkl. Endpunkte: defensiv sortiert, entdoppelt, mit Tangenten. */
function splineLut(profile: ProfileParams): SplineLut {
  const cached = splineLutCache.get(profile)
  if (cached) return cached

  const inner = profile.spline
    .filter((p) => p.t > 1e-6 && p.t < 1 - 1e-6)
    .slice()
    .sort((a, b) => a.t - b.t)

  const ts = [0]
  const rs = [profile.bottomRadiusMm]
  for (const p of inner) {
    if (p.t - ts[ts.length - 1] > 1e-6) {
      ts.push(p.t)
      rs.push(p.rMm)
    }
  }
  ts.push(1)
  rs.push(profile.topRadiusMm)

  // Catmull-Rom-Tangenten: zentrale Differenzen, an den Rändern einseitig.
  const n = ts.length
  const ms = new Array<number>(n)
  ms[0] = (rs[1] - rs[0]) / (ts[1] - ts[0])
  ms[n - 1] = (rs[n - 1] - rs[n - 2]) / (ts[n - 1] - ts[n - 2])
  for (let i = 1; i < n - 1; i++) ms[i] = (rs[i + 1] - rs[i - 1]) / (ts[i + 1] - ts[i - 1])

  const lut = { ts, rs, ms }
  splineLutCache.set(profile, lut)
  return lut
}

/** Kubisches Hermite-Segment zwischen den Stützstellen s und s+1. */
function evalSpline(profile: ProfileParams, t: number): number {
  const { ts, rs, ms } = splineLut(profile)
  const n = ts.length
  let s = 0
  while (s < n - 2 && t > ts[s + 1]) s++
  const h = ts[s + 1] - ts[s]
  const x = clamp01((t - ts[s]) / h)
  const x2 = x * x
  const x3 = x2 * x
  return (
    (2 * x3 - 3 * x2 + 1) * rs[s] +
    (x3 - 2 * x2 + x) * h * ms[s] +
    (-2 * x3 + 3 * x2) * rs[s + 1] +
    (x3 - x2) * h * ms[s + 1]
  )
}

/** Wertet das Profil an t = z/H ∈ [0,1] aus. */
export function evalProfile(profile: ProfileParams, t: number): number {
  switch (profile.mode) {
    case 'preset': {
      const [r0, r1, r2, r3] = profileControlRadii(profile)
      return cubic(r0, r1, r2, r3, t)
    }
    case 'bezier': {
      const { r1Mm, t1, r2Mm, t2 } = profile.bezier
      const u = solveCurveParam(t1, t2, clamp01(t))
      return cubic(profile.bottomRadiusMm, r1Mm, r2Mm, profile.topRadiusMm, u)
    }
    case 'spline':
      return evalSpline(profile, t)
  }
}

/**
 * Griffe, die die aktuell sichtbare Kurve als freie Bezier-Kurve fortführen:
 * kubische Interpolation durch die Kurvenwerte bei t = 0, 1/3, 2/3, 1
 * (für Preset-Kurven exakt – dort IST die Kurve kubisch –, für Splines die
 * kubische Näherung an diesen Stützstellen). Griffe landen auf t = 1/3, 2/3.
 */
export function seedBezierFromProfile(profile: ProfileParams): BezierHandles {
  if (profile.mode === 'bezier') return { ...profile.bezier }
  const f0 = evalProfile(profile, 0)
  const f1 = evalProfile(profile, 1 / 3)
  const f2 = evalProfile(profile, 2 / 3)
  const f3 = evalProfile(profile, 1)
  return {
    r1Mm: (-5 * f0 + 18 * f1 - 9 * f2 + 2 * f3) / 6,
    t1: 1 / 3,
    r2Mm: (2 * f0 - 9 * f1 + 18 * f2 - 5 * f3) / 6,
    t2: 2 / 3,
  }
}

/** Tastet die aktuell sichtbare Kurve mit innerCount Stützpunkten ab. */
export function seedSplineFromProfile(profile: ProfileParams, innerCount = 3): SplinePoint[] {
  if (profile.mode === 'spline') return profile.spline.map((p) => ({ ...p }))
  return Array.from({ length: innerCount }, (_, i) => {
    const t = (i + 1) / (innerCount + 1)
    return { rMm: evalProfile(profile, t), t }
  })
}
