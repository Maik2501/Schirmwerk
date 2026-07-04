import { describe, expect, it } from 'vitest'
import { buildShadeMesh, signedVolume } from './mesh'
import { defaultShadeParams } from './defaults'
import { sampleMinRadius } from './surface'
import type { MeshData, ShadeParams } from './types'

/**
 * Referenz-Parameter für analytisch nachrechenbare Fälle:
 * reiner Zylinder r = 50, H = 100 – ohne Wellen, ohne Blendzonen.
 * (Der "Hals" hat denselben Radius wie das Profil, damit nichts blendet.)
 */
function cylinderParams(): ShadeParams {
  return {
    heightMm: 100,
    neckPosition: 'top',
    profile: {
      mode: 'preset',
      preset: 'zylinder',
      bottomRadiusMm: 50,
      topRadiusMm: 50,
      shapeAmount: 0,
      bezier: { r1Mm: 0, t1: 1 / 3, r2Mm: 0, t2: 2 / 3 },
      spline: [],
    },
    waves: { waveform: 'sinus', n1: 8, a1: 0, n2: 16, a2: 0, twistDeg: 0, phase1Rad: 0, phase2Rad: 0 },
    neck: { socket: 'custom', holeDiameterMm: 99.6, extraClearanceMm: 0.4, heightMm: 0, blendMm: 0 },
    footBlendMm: 0,
  }
}

/** Zählt Kanten: ungerichtet (für Manifold-Test) und gerichtet (Orientierung). */
function edgeStats(mesh: MeshData) {
  const undirected = new Map<string, number>()
  let duplicateDirected = false
  const directed = new Set<string>()
  const idx = mesh.indices
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]]
    for (let e = 0; e < 3; e++) {
      const a = tri[e]
      const b = tri[(e + 1) % 3]
      const dKey = `${a}>${b}`
      // Jede gerichtete Kante darf nur einmal vorkommen – zwei Dreiecke
      // teilen sich eine Kante in entgegengesetzter Richtung (Orientierung!).
      if (directed.has(dKey)) duplicateDirected = true
      directed.add(dKey)
      const uKey = a < b ? `${a}_${b}` : `${b}_${a}`
      undirected.set(uKey, (undirected.get(uKey) ?? 0) + 1)
    }
  }
  return { undirected, duplicateDirected }
}

describe('buildShadeMesh – Wasserdichtheit & Orientierung', () => {
  const res = { thetaSegments: 64, zSegments: 40 }

  it('ist mit Deckeln ein geschlossenes 2-Mannigfaltiges Netz (jede Kante in genau 2 Dreiecken)', () => {
    const mesh = buildShadeMesh(defaultShadeParams(), res, { caps: true })
    const { undirected, duplicateDirected } = edgeStats(mesh)
    for (const count of undirected.values()) expect(count).toBe(2)
    expect(duplicateDirected).toBe(false)
  })

  it('erfüllt die Euler-Charakteristik V − E + F = 2 (topologische Kugel)', () => {
    const mesh = buildShadeMesh(defaultShadeParams(), res, { caps: true })
    const V = mesh.positions.length / 3
    const F = mesh.indices.length / 3
    const E = edgeStats(mesh).undirected.size
    expect(V - E + F).toBe(2)
  })

  it('hat ohne Deckel genau die zwei offenen Ränder (oben + unten)', () => {
    const mesh = buildShadeMesh(defaultShadeParams(), res, { caps: false })
    const { undirected } = edgeStats(mesh)
    let boundary = 0
    for (const count of undirected.values()) {
      expect(count).toBeLessThanOrEqual(2)
      if (count === 1) boundary++
    }
    // je Rand ein geschlossener Ring aus thetaSegments Kanten
    expect(boundary).toBe(2 * res.thetaSegments)
  })

  it('hat positives signiertes Volumen (Normalen zeigen nach außen)', () => {
    const mesh = buildShadeMesh(defaultShadeParams(), res, { caps: true })
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it('trifft das Zylinder-Volumen π·r²·H (bis auf Polygon-Diskretisierung)', () => {
    const mesh = buildShadeMesh(cylinderParams(), { thetaSegments: 128, zSegments: 10 }, { caps: true })
    const exact = Math.PI * 50 * 50 * 100
    const vol = signedVolume(mesh)
    // eingeschriebenes 128-Eck: Fläche = ½·N·r²·sin(2π/N) ≈ 99.96 % des Kreises
    expect(vol / exact).toBeGreaterThan(0.999)
    expect(vol / exact).toBeLessThanOrEqual(1.0)
  })

  it('liefert nur endliche Positionen und Einheitsnormalen', () => {
    const mesh = buildShadeMesh(defaultShadeParams(), res, { caps: true })
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true)
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2])
      expect(len).toBeGreaterThan(0.999)
      expect(len).toBeLessThan(1.001)
    }
  })
})

describe('Kragen unten (neckPosition bottom)', () => {
  const res = { thetaSegments: 64, zSegments: 40 }

  it('bleibt ein geschlossenes, korrekt orientiertes 2-Mannigfaltiges Netz', () => {
    const params = defaultShadeParams()
    params.neckPosition = 'bottom'
    params.footBlendMm = 0
    const mesh = buildShadeMesh(params, res, { caps: true })
    const { undirected, duplicateDirected } = edgeStats(mesh)
    for (const count of undirected.values()) expect(count).toBe(2)
    expect(duplicateDirected).toBe(false)
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it('hält r > 0 auch mit Kragen am Bett', () => {
    const params = defaultShadeParams()
    params.neckPosition = 'bottom'
    expect(sampleMinRadius(params, { thetaSegments: 128, zSegments: 128 })).toBeGreaterThan(0)
  })
})

describe('Radius-Validität', () => {
  it('bleibt für das Startdesign überall > 0', () => {
    expect(sampleMinRadius(defaultShadeParams(), { thetaSegments: 256, zSegments: 256 })).toBeGreaterThan(0)
  })

  it('bleibt für alle Profil-Presets mit Startwellen > 0', () => {
    for (const preset of ['zylinder', 'konus', 'tropfen', 'glocke'] as const) {
      const params = defaultShadeParams()
      params.profile.preset = preset
      const min = sampleMinRadius(params, { thetaSegments: 128, zSegments: 128 })
      expect(min, `Preset ${preset}`).toBeGreaterThan(0)
    }
  })
})
