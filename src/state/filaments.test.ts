import { describe, expect, it } from 'vitest'
import { PETG_TRANSLUCENT } from './filaments'

describe('PETG_TRANSLUCENT', () => {
  it('enthält Klar plus die 8 Bambu-Farben', () => {
    expect(PETG_TRANSLUCENT).toHaveLength(9)
    expect(PETG_TRANSLUCENT[0].id).toBe('clear')
  })

  it('hat eindeutige ids und valide Hex-Codes', () => {
    const ids = new Set(PETG_TRANSLUCENT.map((f) => f.id))
    expect(ids.size).toBe(PETG_TRANSLUCENT.length)
    for (const f of PETG_TRANSLUCENT) {
      expect(f.hex, f.name).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
