import { describe, expect, it } from 'vitest'
import {
  evalProfile,
  profileControlRadii,
  seedBezierFromProfile,
  seedSplineFromProfile,
} from './profile'
import type { ProfileParams } from './types'

/** Tropfen-Preset wie im Startdesign; freie Felder mit Platzhaltern. */
function presetProfile(overrides?: Partial<ProfileParams>): ProfileParams {
  return {
    mode: 'preset',
    preset: 'tropfen',
    bottomRadiusMm: 46,
    topRadiusMm: 26,
    shapeAmount: 0.65,
    bezier: { r1Mm: 0, t1: 1 / 3, r2Mm: 0, t2: 2 / 3 },
    spline: [],
    ...overrides,
  }
}

describe('Freie Bezier-Kurve', () => {
  it('übernimmt die Preset-Kurve beim Seed exakt (Griffe auf t = 1/3, 2/3)', () => {
    const preset = presetProfile()
    const frei = presetProfile({ mode: 'bezier', bezier: seedBezierFromProfile(preset) })
    for (let i = 0; i <= 100; i++) {
      expect(evalProfile(frei, i / 100)).toBeCloseTo(evalProfile(preset, i / 100), 6)
    }
  })

  it('Seed-Griffe entsprechen den inneren Preset-Kontrollradien', () => {
    const preset = presetProfile()
    const [, r1, r2] = profileControlRadii(preset)
    const b = seedBezierFromProfile(preset)
    expect(b.r1Mm).toBeCloseTo(r1, 6)
    expect(b.r2Mm).toBeCloseTo(r2, 6)
  })

  it('trifft die Endradien exakt, auch bei ungleichmäßigen Höhen-Griffen', () => {
    const p = presetProfile({ mode: 'bezier', bezier: { r1Mm: 80, t1: 0.1, r2Mm: 10, t2: 0.9 } })
    expect(evalProfile(p, 0)).toBeCloseTo(46, 9)
    expect(evalProfile(p, 1)).toBeCloseTo(26, 9)
  })

  it('invertiert die Höhenkomponente korrekt: Kurvenpunkte (t*, r*) werden reproduziert', () => {
    const t1 = 0.15
    const t2 = 0.6
    const r1 = 70
    const r2 = 15
    const p = presetProfile({ mode: 'bezier', bezier: { r1Mm: r1, t1, r2Mm: r2, t2 } })
    for (const u of [0.1, 0.35, 0.5, 0.77, 0.93]) {
      const v = 1 - u
      // Vorwärts ausgewertet: u → (t*, r*); evalProfile(t*) muss r* liefern
      const tStar = 3 * v * v * u * t1 + 3 * v * u * u * t2 + u * u * u
      const rStar = v * v * v * 46 + 3 * v * v * u * r1 + 3 * v * u * u * r2 + u * u * u * 26
      expect(evalProfile(p, tStar)).toBeCloseTo(rStar, 6)
    }
  })

  it('bleibt bei zusammenfallenden Griff-Höhen (t1 = t2) endlich und trifft die Enden', () => {
    const p = presetProfile({ mode: 'bezier', bezier: { r1Mm: 90, t1: 0.5, r2Mm: 5, t2: 0.5 } })
    for (let i = 0; i <= 200; i++) {
      expect(Number.isFinite(evalProfile(p, i / 200))).toBe(true)
    }
    expect(evalProfile(p, 0)).toBeCloseTo(46, 6)
    expect(evalProfile(p, 1)).toBeCloseTo(26, 6)
  })
})

describe('Freier Spline', () => {
  it('läuft exakt durch Endradien und alle Stützpunkte', () => {
    const p = presetProfile({
      mode: 'spline',
      spline: [
        { rMm: 60, t: 0.25 },
        { rMm: 75, t: 0.5 },
        { rMm: 30, t: 0.8 },
      ],
    })
    expect(evalProfile(p, 0)).toBeCloseTo(46, 9)
    expect(evalProfile(p, 0.25)).toBeCloseTo(60, 9)
    expect(evalProfile(p, 0.5)).toBeCloseTo(75, 9)
    expect(evalProfile(p, 0.8)).toBeCloseTo(30, 9)
    expect(evalProfile(p, 1)).toBeCloseTo(26, 9)
  })

  it('ist ohne Stützpunkte die Gerade zwischen den Endradien', () => {
    const p = presetProfile({ mode: 'spline', spline: [] })
    expect(evalProfile(p, 0.25)).toBeCloseTo(41, 6)
    expect(evalProfile(p, 0.5)).toBeCloseTo(36, 6)
    expect(evalProfile(p, 0.75)).toBeCloseTo(31, 6)
  })

  it('sortiert unsortierte Stützpunkte defensiv', () => {
    const sorted = presetProfile({
      mode: 'spline',
      spline: [
        { rMm: 60, t: 0.3 },
        { rMm: 40, t: 0.7 },
      ],
    })
    const unsorted = presetProfile({
      mode: 'spline',
      spline: [
        { rMm: 40, t: 0.7 },
        { rMm: 60, t: 0.3 },
      ],
    })
    for (let i = 0; i <= 50; i++) {
      expect(evalProfile(unsorted, i / 50)).toBeCloseTo(evalProfile(sorted, i / 50), 9)
    }
  })

  it('Seed tastet die aktuell sichtbare Kurve ab', () => {
    const preset = presetProfile()
    const pts = seedSplineFromProfile(preset)
    expect(pts).toHaveLength(3)
    for (const p of pts) {
      expect(p.rMm).toBeCloseTo(evalProfile(preset, p.t), 9)
    }
  })
})
