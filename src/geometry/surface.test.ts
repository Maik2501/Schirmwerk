import { describe, expect, it } from 'vitest'
import { neckRadiusMm, overhangAngleDeg, radiusAt, smoothstep, TWO_PI } from './surface'
import { evalProfile } from './profile'
import { defaultShadeParams } from './defaults'
import type { ShadeParams } from './types'

/** Parametersatz ohne Hals/Fuß-Blend, damit die Wellenformel pur messbar ist. */
function bareParams(overrides?: Partial<ShadeParams['waves']>): ShadeParams {
  return {
    heightMm: 100,
    profile: { preset: 'zylinder', bottomRadiusMm: 50, topRadiusMm: 50, shapeAmount: 0 },
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
    params.profile = { preset: 'konus', bottomRadiusMm: 20, topRadiusMm: 70, shapeAmount: 0 }
    params.neck = { socket: 'custom', holeDiameterMm: 140, extraClearanceMm: 0, heightMm: 0, blendMm: 0 }
    expect(overhangAngleDeg(params, 0, 25)).toBeCloseTo(45, 1)
  })

  it('zählt nach innen geneigte Wände (gestützt) nicht als Überhang', () => {
    const params = bareParams({ a1: 0 })
    params.heightMm = 50
    params.profile = { preset: 'konus', bottomRadiusMm: 70, topRadiusMm: 20, shapeAmount: 0 }
    params.neck = { socket: 'custom', holeDiameterMm: 40, extraClearanceMm: 0, heightMm: 0, blendMm: 0 }
    expect(overhangAngleDeg(params, 0, 25)).toBe(0)
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
    const profile = { preset: 'tropfen', bottomRadiusMm: 46, topRadiusMm: 26, shapeAmount: 0.65 } as const
    expect(evalProfile(profile, 0)).toBeCloseTo(46, 9)
    expect(evalProfile(profile, 1)).toBeCloseTo(26, 9)
  })

  it('Tropfen-Profil baucht über beide Endradien hinaus', () => {
    const profile = { preset: 'tropfen', bottomRadiusMm: 46, topRadiusMm: 26, shapeAmount: 0.65 } as const
    let max = 0
    for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, evalProfile(profile, t))
    expect(max).toBeGreaterThan(46)
  })
})
