import { describe, expect, it } from 'vitest'
import {
  neckRadiusMm,
  overhangAngleDeg,
  radiusAt,
  silhouetteOverhangProfile,
  smoothstep,
  TWO_PI,
} from './surface'
import { evalProfile } from './profile'
import { defaultShadeParams } from './defaults'
import type { ProfileParams, ShadeParams } from './types'

/** Platzhalter für die freien Modi – im Preset-Modus ungenutzt. */
const FREI: Pick<ProfileParams, 'mode' | 'bezier' | 'spline'> = {
  mode: 'preset',
  bezier: { r1Mm: 0, t1: 1 / 3, r2Mm: 0, t2: 2 / 3 },
  spline: [],
}

/** Parametersatz ohne Hals/Fuß-Blend, damit die Wellenformel pur messbar ist. */
function bareParams(overrides?: Partial<ShadeParams['waves']>): ShadeParams {
  return {
    heightMm: 100,
    neckPosition: 'top',
    profile: { ...FREI, preset: 'zylinder', bottomRadiusMm: 50, topRadiusMm: 50, shapeAmount: 0 },
    waves: {
      n1: 6, a1: 0.2, n2: 12, a2: 0, twistDeg: 0, phase1Rad: 0, phase2Rad: 0,
      ...overrides,
    },
    neck: { socket: 'custom', holeDiameterMm: 100, extraClearanceMm: 0, heightMm: 0, blendMm: 0 },
    footBlendMm: 0,
  }
}

/** θ des Radius-Maximums per feiner Rasterung (Grad, [0..360)). */
function crestAngleDeg(params: ShadeParams, z: number): number {
  let best = 0
  let bestR = -Infinity
  const steps = 8192
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * TWO_PI
    const r = radiusAt(params, theta, z)
    if (r > bestR) {
      bestR = r
      best = theta
    }
  }
  return (best * 180) / Math.PI
}

/**
 * Wellenberge wiederholen sich alle 360°/n – Winkel sind also nur modulo
 * dieser Periode definiert. Der Scan darf einen beliebigen Berg finden.
 */
function modDistDeg(a: number, b: number, period: number): number {
  const d = (((a - b) % period) + period) % period
  return Math.min(d, period - d)
}

describe('Wellen & Twist', () => {
  it('rotiert die Hauptwellen über die Höhe um genau twistDeg (unabhängig von n1)', () => {
    const params = bareParams({ twistDeg: 20 })
    // n1=6, φ=0: Wellenberge unten bei sin(6θ)=1 → θ = 15° + k·60°
    expect(modDistDeg(crestAngleDeg(params, 0), 15, 60)).toBeLessThan(0.5)
    // oben um +20° (CCW) rotiert → 35° + k·60°
    const top = crestAngleDeg(params, 100 * (1 - 1e-9))
    expect(modDistDeg(top, 35, 60)).toBeLessThan(0.5)
  })

  it('dreht die Sekundärwellen gegenläufig', () => {
    const params = bareParams({ a1: 0, a2: 0.2, n2: 6, twistDeg: 20 })
    // gleiche Basislage (15°), aber Rotation −20° → −5° ≡ 55° mod 60
    const top = crestAngleDeg(params, 100 * (1 - 1e-9))
    expect(modDistDeg(top, 55, 60)).toBeLessThan(0.5)
  })

  it('skaliert die Amplitude mit dem lokalen Profilradius', () => {
    const params = bareParams()
    // r_max/r_min = (1+a1)/(1−a1) bei Zylinder r=50
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 4096; i++) {
      const r = radiusAt(params, (i / 4096) * TWO_PI, 50)
      min = Math.min(min, r)
      max = Math.max(max, r)
    }
    expect(max).toBeCloseTo(50 * 1.2, 3)
    expect(min).toBeCloseTo(50 * 0.8, 3)
  })
})

describe('Hals-Blend', () => {
  it('erreicht am oberen Ende exakt den Halsradius (Loch + Toleranz)', () => {
    const params = defaultShadeParams()
    const rTop = radiusAt(params, 1.234, params.heightMm)
    expect(rTop).toBeCloseTo(neckRadiusMm(params.neck), 6)
    expect(neckRadiusMm(params.neck)).toBeCloseTo((40 + 0.4) / 2, 6)
  })

  it('ist im Kragen über den Umfang konstant rund (Wellen ausgeblendet)', () => {
    const params = defaultShadeParams()
    const zKragen = params.heightMm - params.neck.heightMm / 2
    const samples = Array.from({ length: 64 }, (_, i) => radiusAt(params, (i / 64) * TWO_PI, zKragen))
    const min = Math.min(...samples)
    const max = Math.max(...samples)
    expect(max - min).toBeLessThan(1e-9)
  })
})

describe('Überhang-Winkel', () => {
  it('ist 0° für eine senkrechte Zylinderwand', () => {
    const params = bareParams({ a1: 0 })
    expect(overhangAngleDeg(params, 0.7, 50)).toBeCloseTo(0, 5)
  })

  it('ist 45° für einen nach oben öffnenden 45°-Konus', () => {
    const params = bareParams({ a1: 0 })
    params.heightMm = 50
    params.profile = { ...FREI, preset: 'konus', bottomRadiusMm: 20, topRadiusMm: 70, shapeAmount: 0 }
    params.neck = { socket: 'custom', holeDiameterMm: 140, extraClearanceMm: 0, heightMm: 0, blendMm: 0 }
    expect(overhangAngleDeg(params, 0, 25)).toBeCloseTo(45, 1)
  })

  it('zählt nach innen geneigte Wände (gestützt) nicht als Überhang', () => {
    const params = bareParams({ a1: 0 })
    params.heightMm = 50
    params.profile = { ...FREI, preset: 'konus', bottomRadiusMm: 70, topRadiusMm: 20, shapeAmount: 0 }
    params.neck = { socket: 'custom', holeDiameterMm: 40, extraClearanceMm: 0, heightMm: 0, blendMm: 0 }
    expect(overhangAngleDeg(params, 0, 25)).toBe(0)
  })
})

describe('Kragen unten (neckPosition bottom)', () => {
  function standingParams(): ShadeParams {
    const params = defaultShadeParams()
    params.neckPosition = 'bottom'
    params.footBlendMm = 0
    return params
  }

  it('ist im Kragen am Bett konstant rund und trifft den Halsradius', () => {
    const params = standingParams()
    const zKragen = params.neck.heightMm / 2
    const samples = Array.from({ length: 64 }, (_, i) => radiusAt(params, (i / 64) * TWO_PI, zKragen))
    expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(1e-9)
    expect(samples[0]).toBeCloseTo(neckRadiusMm(params.neck), 6)
  })

  it('endet oben frei gewellt (footBlendMm = 0)', () => {
    const params = standingParams()
    const zTop = params.heightMm * (1 - 1e-9)
    const samples = Array.from({ length: 128 }, (_, i) => radiusAt(params, (i / 128) * TWO_PI, zTop))
    const spanne = Math.max(...samples) - Math.min(...samples)
    // volle Wellenamplitude: ±(a1+a2)·P ≈ ±19,5 % – deutlich, nicht rund
    expect(spanne).toBeGreaterThan(5)
  })

  it('läuft oben rund aus, wenn ein Wellen-Auslauf gesetzt ist', () => {
    const params = standingParams()
    params.footBlendMm = 10
    const zTop = params.heightMm * (1 - 1e-9)
    const samples = Array.from({ length: 64 }, (_, i) => radiusAt(params, (i / 64) * TWO_PI, zTop))
    expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(1e-9)
  })
})

describe('silhouetteOverhangProfile', () => {
  /** Hüllkurve (max. Radius je Höhe) wie im Riss abtasten. */
  function sampleOuter(params: ShadeParams, rows: number, thetaSamples: number) {
    const outer: [number, number][] = []
    for (let i = 0; i <= rows; i++) {
      const z = (i / rows) * params.heightMm
      let hi = -Infinity
      for (let j = 0; j < thetaSamples; j++) {
        hi = Math.max(hi, radiusAt(params, (j / thetaSamples) * TWO_PI, z))
      }
      outer.push([hi, z])
    }
    return outer
  }

  it('misst für den 45°-Konus überall ≈ 45°', () => {
    const params = bareParams({ a1: 0 })
    params.heightMm = 50
    params.profile = { ...FREI, preset: 'konus', bottomRadiusMm: 20, topRadiusMm: 70, shapeAmount: 0 }
    params.neck = { socket: 'custom', holeDiameterMm: 140, extraClearanceMm: 0, heightMm: 0, blendMm: 0 }
    const { perRowDeg, maxDeg } = silhouetteOverhangProfile(sampleOuter(params, 20, 32))
    for (const a of perRowDeg) expect(a).toBeCloseTo(45, 1)
    expect(maxDeg).toBeCloseTo(45, 1)
  })

  it('meldet für Wellen + Twist am Zylinder KEINEN Überhang (keine Falschalarme an Flanken)', () => {
    // Lokal kippt die Flächennormale hier weit nach unten (overhangAngleDeg
    // misst 60°+), aber die Silhouette bleibt senkrecht – und genau solche
    // Designs drucken nachweislich (Referenzfoto). Die Metrik darf hier
    // nicht anschlagen.
    const params = bareParams({ a1: 0.2, n1: 10, twistDeg: 180 })
    let localMax = 0
    for (let j = 0; j < 256; j++) {
      localMax = Math.max(localMax, overhangAngleDeg(params, (j / 256) * TWO_PI, 50))
    }
    expect(localMax).toBeGreaterThan(45)
    const { maxDeg } = silhouetteOverhangProfile(sampleOuter(params, 16, 96))
    expect(maxDeg).toBeLessThan(1)
  })

  it('dämpft kurze Ausreißer über das ±10-mm-Fenster', () => {
    // Einzel-Spike von 4 mm: lokal wären das atan(4/1) = 76°, übers
    // Fenster gemessen nur ~11° – kurze Anstiege steckt der Druck weg.
    const outer: [number, number][] = Array.from({ length: 41 }, (_, i) => [50, i])
    outer[20][0] = 54
    const { maxDeg } = silhouetteOverhangProfile(outer)
    expect(maxDeg).toBeGreaterThan(8)
    expect(maxDeg).toBeLessThan(15)
  })

  it('bleibt beim Startdesign unter der Warnschwelle (Fuß-Blend heilt)', () => {
    // Das Referenzdesign druckt nachweislich – der Check darf es nicht
    // rot markieren, obwohl der Wellen-Einlauf am Fuß lokal steil ist.
    const { maxDeg } = silhouetteOverhangProfile(sampleOuter(defaultShadeParams(), 96, 128))
    expect(maxDeg).toBeLessThan(50)
  })

  it('erkennt eine echte Auskragung und verortet sie in den richtigen Reihen', () => {
    // Rampe r 30 → 80 über 20 mm Höhe (Steigung 2.5 ≙ 68°) mitten im Profil
    const outer: [number, number][] = Array.from({ length: 61 }, (_, i) => {
      const z = i
      const r = z < 20 ? 30 : z < 40 ? 30 + (z - 20) * 2.5 : 80
      return [r, z]
    })
    const { perRowDeg, maxDeg } = silhouetteOverhangProfile(outer)
    expect(maxDeg).toBeGreaterThan(60)
    expect(perRowDeg[30]).toBeGreaterThan(60) // Rampenmitte
    expect(perRowDeg[5]).toBeLessThan(1) // Zylinderteile bleiben ruhig
    expect(perRowDeg[55]).toBeLessThan(1)
  })
})

describe('Bausteine', () => {
  it('smoothstep klemmt und interpoliert glatt', () => {
    expect(smoothstep(0, 10, -5)).toBe(0)
    expect(smoothstep(0, 10, 15)).toBe(1)
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 6)
    // entartete Kanten (Blendhöhe 0) dürfen nicht durch 0 teilen
    expect(smoothstep(7, 7, 6.9)).toBe(0)
    expect(smoothstep(7, 7, 7)).toBe(1)
  })

  it('Bezier-Profil trifft die Endradien exakt', () => {
    const profile: ProfileParams = { ...FREI, preset: 'tropfen', bottomRadiusMm: 46, topRadiusMm: 26, shapeAmount: 0.65 }
    expect(evalProfile(profile, 0)).toBeCloseTo(46, 9)
    expect(evalProfile(profile, 1)).toBeCloseTo(26, 9)
  })

  it('Tropfen-Profil baucht über beide Endradien hinaus', () => {
    const profile: ProfileParams = { ...FREI, preset: 'tropfen', bottomRadiusMm: 46, topRadiusMm: 26, shapeAmount: 0.65 }
    let max = 0
    for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, evalProfile(profile, t))
    expect(max).toBeGreaterThan(46)
  })
})
