import { describe, expect, it } from 'vitest'
import { buildShadeMesh } from './mesh'
import { defaultShadeParams } from './defaults'
import { meshToBinaryStl, stlByteLength, STL_HEADER_BYTES } from './stl'

/** Kleines, aber vollständiges Export-Mesh (mit Deckeln). */
function smallMesh() {
  return buildShadeMesh(defaultShadeParams(), { thetaSegments: 8, zSegments: 3 }, { caps: true })
}

describe('meshToBinaryStl', () => {
  it('hat exakt die Größe 84 + 50·n und deklariert n im Zähler', () => {
    const mesh = smallMesh()
    const n = mesh.indices.length / 3
    expect(n).toBe(2 * 8 * 3 + 2 * 8) // Mantel + zwei Fächer-Deckel
    const stl = meshToBinaryStl(mesh)
    expect(stl.byteLength).toBe(stlByteLength(n))
    expect(new DataView(stl).getUint32(STL_HEADER_BYTES, true)).toBe(n)
  })

  it('beginnt nicht mit "solid" (Binär-Erkennung vieler Parser)', () => {
    const stl = meshToBinaryStl(smallMesh())
    const head = String.fromCharCode(...new Uint8Array(stl, 0, 5))
    expect(head.toLowerCase()).not.toBe('solid')
    expect(head).toBe('Schir')
  })

  it('schreibt die Eckpunkte des ersten Dreiecks bitgenau (little-endian f32)', () => {
    const mesh = smallMesh()
    const stl = meshToBinaryStl(mesh)
    const view = new DataView(stl)
    const base = STL_HEADER_BYTES + 4 + 12 // nach Zähler + Normale
    for (let corner = 0; corner < 3; corner++) {
      const vi = mesh.indices[corner] * 3
      for (let axis = 0; axis < 3; axis++) {
        expect(view.getFloat32(base + corner * 12 + axis * 4, true)).toBe(
          mesh.positions[vi + axis],
        )
      }
    }
  })

  it('hat Einheits- oder Null-Normalen und 0-Attribute für alle Dreiecke', () => {
    const mesh = smallMesh()
    const stl = meshToBinaryStl(mesh)
    const view = new DataView(stl)
    const n = mesh.indices.length / 3
    for (let t = 0; t < n; t++) {
      const o = STL_HEADER_BYTES + 4 + t * 50
      const len = Math.hypot(
        view.getFloat32(o, true),
        view.getFloat32(o + 4, true),
        view.getFloat32(o + 8, true),
      )
      expect(len === 0 || (len > 0.999 && len < 1.001)).toBe(true)
      expect(view.getUint16(o + 48, true)).toBe(0)
    }
  })

  it('Deckel-Normalen zeigen nach außen: Boden −z, Hals +z', () => {
    const mesh = smallMesh()
    const stl = meshToBinaryStl(mesh)
    const view = new DataView(stl)
    const mantleTris = 2 * 8 * 3
    // Deckel-Dreiecke abwechselnd Boden/Hals (siehe mesh.ts Schritt 5)
    const bottom = STL_HEADER_BYTES + 4 + mantleTris * 50
    expect(view.getFloat32(bottom + 8, true)).toBeCloseTo(-1, 5)
    const top = bottom + 50
    expect(view.getFloat32(top + 8, true)).toBeCloseTo(1, 5)
  })
})
