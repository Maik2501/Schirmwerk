/**
 * Binärer STL-Writer – framework-frei, direkt aus MeshData.
 *
 * Aufbau (little-endian, https://de.wikipedia.org/wiki/STL-Schnittstelle):
 *   80 Byte Header (ASCII, mit 0 gepolstert)
 *    4 Byte uint32: Dreiecksanzahl
 *   je Dreieck 50 Byte: Normale (3×f32), 3 Ecken (9×f32), uint16 Attribut (0)
 *
 * Details, die Slicer glücklich machen:
 * - Der Header darf NICHT mit "solid" beginnen – daran erkennen viele
 *   Parser das ASCII-Format und verschlucken sich dann am Binärteil.
 * - STL trägt Flächennormalen, keine Vertex-Normalen. Wir berechnen sie
 *   aus der Windung (b−a)×(c−a); die ist im Mesh konsistent CCW von außen,
 *   die Normalen zeigen also nach außen (Orientierung testen die
 *   mesh-Tests über das signierte Volumen).
 * - Einheiten: STL ist einheitenlos, Slicer interpretieren die Werte als
 *   mm – exakt unsere Modell-Einheit, es wird nichts skaliert.
 */
import type { MeshData } from './types'

export const STL_HEADER_BYTES = 80
export const STL_TRIANGLE_BYTES = 50

/** Dateigröße eines binären STL mit triCount Dreiecken, in Byte. */
export function stlByteLength(triCount: number): number {
  return STL_HEADER_BYTES + 4 + STL_TRIANGLE_BYTES * triCount
}

export function meshToBinaryStl(
  mesh: MeshData,
  headerText = 'Schirmwerk Lampenschirm-Generator (Einheiten mm, Z oben)',
): ArrayBuffer {
  const { positions: p, indices } = mesh
  const triCount = indices.length / 3
  const buffer = new ArrayBuffer(stlByteLength(triCount))
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // Header: reines ASCII, Rest bleibt 0-gepolstert
  for (let i = 0; i < Math.min(headerText.length, STL_HEADER_BYTES); i++) {
    bytes[i] = headerText.charCodeAt(i) & 0x7f
  }
  view.setUint32(STL_HEADER_BYTES, triCount, true)

  let o = STL_HEADER_BYTES + 4
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3
    const b = indices[t + 1] * 3
    const c = indices[t + 2] * 3

    // Flächennormale aus der Windung: n = (B−A) × (C−A), normiert
    const abx = p[b] - p[a]
    const aby = p[b + 1] - p[a + 1]
    const abz = p[b + 2] - p[a + 2]
    const acx = p[c] - p[a]
    const acy = p[c + 1] - p[a + 1]
    const acz = p[c + 2] - p[a + 2]
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.hypot(nx, ny, nz)
    if (len > 0) {
      nx /= len
      ny /= len
      nz /= len
    } else {
      // entartetes Dreieck: Null-Normale ist laut Spezifikation zulässig
      nx = ny = nz = 0
    }

    view.setFloat32(o, nx, true)
    view.setFloat32(o + 4, ny, true)
    view.setFloat32(o + 8, nz, true)
    o += 12
    for (const vi of [a, b, c]) {
      view.setFloat32(o, p[vi], true)
      view.setFloat32(o + 4, p[vi + 1], true)
      view.setFloat32(o + 8, p[vi + 2], true)
      o += 12
    }
    view.setUint16(o, 0, true) // Attribut-Bytes: immer 0
    o += 2
  }

  return buffer
}
