import { describe, expect, it } from 'vitest'
import { buildShadeMesh } from './mesh'
import { defaultShadeParams } from './defaults'
import { estimateVasePrint } from './printEstimate'
import { meshTo3mf, modelXml } from './threeMf'
import { buildZip, crc32 } from './zip'
import type { ShadeParams } from './types'

/** Referenz: reiner Zylinder r = 50, H = 100 (analytisch nachrechenbar). */
function cylinderParams(): ShadeParams {
  const params = defaultShadeParams()
  params.heightMm = 100
  params.neckPosition = 'top'
  params.profile = {
    ...params.profile,
    mode: 'preset',
    preset: 'zylinder',
    bottomRadiusMm: 50,
    topRadiusMm: 50,
    shapeAmount: 0,
  }
  params.waves = { ...params.waves, a1: 0, a2: 0, twistDeg: 0 }
  params.neck = { socket: 'custom', holeDiameterMm: 99.6, extraClearanceMm: 0.4, heightMm: 0, blendMm: 0 }
  params.footBlendMm = 0
  return params
}

describe('crc32 & buildZip', () => {
  it('liefert den Standard-Prüfvektor („123456789“ → CBF43926)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('baut ein strukturell gültiges ZIP (Signaturen, EOCD-Zähler, Roundtrip)', async () => {
    const payload = new TextEncoder().encode('Schirmwerk '.repeat(200))
    const zip = new Uint8Array(await buildZip([{ name: 'test.txt', data: payload }]))
    const view = new DataView(zip.buffer)
    // Local-Header- und EOCD-Signatur
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const eocd = zip.length - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054b50)
    expect(view.getUint16(eocd + 10, true)).toBe(1) // ein Eintrag
    // DEFLATE hat die Wiederholungen komprimiert
    expect(zip.length).toBeLessThan(payload.length)
    // Roundtrip: Eintrag dekomprimieren und vergleichen
    const nameLen = view.getUint16(26, true)
    const compSize = view.getUint32(18, true)
    const comp = zip.slice(30 + nameLen, 30 + nameLen + compSize)
    const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const back = new Uint8Array(await new Response(stream).arrayBuffer())
    expect(back).toEqual(payload)
    expect(crc32(back)).toBe(view.getUint32(14, true))
  })
})

describe('3MF', () => {
  const mesh = buildShadeMesh(cylinderParams(), { thetaSegments: 12, zSegments: 3 }, { caps: true })

  it('Modell-XML: Millimeter, alle Vertices und Dreiecke, Build-Item', () => {
    const xml = modelXml(mesh)
    expect(xml).toContain('unit="millimeter"')
    expect(xml.match(/<vertex /g)).toHaveLength(mesh.positions.length / 3)
    expect(xml.match(/<triangle /g)).toHaveLength(mesh.indices.length / 3)
    expect(xml).toContain('<item objectid="1"/>')
  })

  it('verpackt als ZIP mit den drei OPC-Teilen', async () => {
    const buf = new Uint8Array(await meshTo3mf(mesh))
    expect(new DataView(buf.buffer).getUint32(0, true)).toBe(0x04034b50)
    const text = new TextDecoder('latin1').decode(buf)
    expect(text).toContain('[Content_Types].xml')
    expect(text).toContain('_rels/.rels')
    expect(text).toContain('3D/3dmodel.model')
  })
})

describe('estimateVasePrint', () => {
  it('trifft den Zylinder analytisch: Länge, Gramm, Minuten', () => {
    // L = 2π·50 mm × (100/0,2) Schichten ≈ 157,08 m
    const est = estimateVasePrint(cylinderParams())
    expect(est.lengthM).toBeGreaterThan(157.08 * 0.995)
    expect(est.lengthM).toBeLessThanOrEqual(157.08)
    // V = L·0,42·0,2 mm³ → ×1,27 g/cm³ ≈ 16,8 g
    expect(est.grams).toBeCloseTo(16.76, 0)
    // 157 m bei 80 mm/s ≈ 32,7 min
    expect(est.minutes).toBeCloseTo(32.7, 0)
  })

  it('Wellen verlängern die Bahn spürbar', () => {
    const glatt = estimateVasePrint(cylinderParams())
    const wellig = cylinderParams()
    wellig.waves = { ...wellig.waves, a1: 0.16, a2: 0.035 }
    const est = estimateVasePrint(wellig)
    expect(est.lengthM).toBeGreaterThan(glatt.lengthM * 1.05)
  })
})
