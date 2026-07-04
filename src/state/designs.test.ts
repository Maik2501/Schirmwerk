import { describe, expect, it } from 'vitest'
import { defaultShadeParams } from '../geometry/defaults'
import {
  decodeShare,
  encodeShare,
  loadDesigns,
  parseLibraryJson,
  persistDesigns,
  sanitizeParams,
  type SavedDesign,
} from './designs'

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

function demoDesign(): SavedDesign {
  return {
    id: 'test-1',
    name: 'Bürolampe „Ω“ – groß & schön',
    savedAt: '2026-07-04T12:00:00.000Z',
    params: defaultShadeParams(),
    shadeColorId: 'olive',
    mounting: 'stehend',
  }
}

describe('Share-URL', () => {
  it('encode/decode ist ein verlustfreier Roundtrip (inkl. Unicode im Namen)', () => {
    const d = demoDesign()
    const decoded = decodeShare(encodeShare(d))
    expect(decoded).not.toBeNull()
    expect(decoded!.name).toBe(d.name)
    expect(decoded!.mounting).toBe('stehend')
    expect(decoded!.shadeColorId).toBe('olive')
    expect(decoded!.params).toEqual(d.params)
  })

  it('ist base64url-sicher (keine +, /, = im Hash)', () => {
    const s = encodeShare(demoDesign())
    expect(s).not.toMatch(/[+/=]/)
  })

  it('liefert null für Müll', () => {
    expect(decodeShare('nicht-base64-!!!')).toBeNull()
    expect(decodeShare(btoa('kein json'))).toBeNull()
  })
})

describe('sanitizeParams', () => {
  it('ersetzt kaputte Werte feldweise durch Defaults', () => {
    const d = defaultShadeParams()
    const s = sanitizeParams({
      heightMm: Number.NaN,
      neckPosition: 'diagonal',
      profile: { preset: 'raumschiff', bottomRadiusMm: 60 },
      waves: { waveform: 'chaos', n1: 12 },
    })!
    expect(s.heightMm).toBe(d.heightMm)
    expect(s.neckPosition).toBe('top')
    expect(s.profile.preset).toBe(d.profile.preset)
    expect(s.profile.bottomRadiusMm).toBe(60)
    expect(s.waves.waveform).toBe('sinus')
    expect(s.waves.n1).toBe(12)
  })

  it('filtert ungültige Spline-Punkte heraus', () => {
    const s = sanitizeParams({
      profile: { mode: 'spline', spline: [{ rMm: 40, t: 0.5 }, { rMm: 'x', t: 0.7 }, null] },
    })!
    expect(s.profile.spline).toEqual([{ rMm: 40, t: 0.5 }])
  })

  it('lehnt Nicht-Objekte ab', () => {
    expect(sanitizeParams('quatsch')).toBeNull()
    expect(sanitizeParams(null)).toBeNull()
  })
})

describe('Bibliothek (Storage & Datei)', () => {
  it('persist/load ist ein Roundtrip über injizierten Storage', () => {
    const storage = fakeStorage()
    persistDesigns([demoDesign()], storage)
    const loaded = loadDesigns(storage)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toContain('Bürolampe')
    expect(loaded[0].params).toEqual(defaultShadeParams())
  })

  it('übersteht kaputtes JSON im Storage', () => {
    const storage = fakeStorage()
    storage.setItem('schirmwerk.designs.v1', '{kaputt')
    expect(loadDesigns(storage)).toEqual([])
  })

  it('parseLibraryJson übernimmt nur valide Einträge', () => {
    const text = JSON.stringify([demoDesign(), { params: 'müll' }, 42])
    const designs = parseLibraryJson(text)
    expect(designs).toHaveLength(1)
  })
})
