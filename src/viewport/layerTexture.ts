/**
 * Prozedurale Layerlinien-Normal-Map: eine einzige Druckraupen-Periode
 * als 1×64-DataTexture, vertikal (v-Richtung) endlos wiederholt.
 *
 * Das Raupenprofil ist näherungsweise eine Wulst – die Normale kippt mit
 * der Ableitung des Höhenprofils sinusförmig in v. Die UVs des Mantels
 * sind v = z/H, d. h. repeat.y = H / Schichthöhe ergibt exakt eine Raupe
 * pro gedruckter Schicht, in echten Millimetern.
 *
 * Kein Bild-Download, deterministisch, eine Textur für die ganze App.
 */
import * as THREE from 'three'

/** Angenommene Schichthöhe der Vorschau-Optik, mm (0.2 = Standardprofil) */
export const LAYER_HEIGHT_MM = 0.2

let cached: THREE.DataTexture | null = null

export function layerNormalTexture(): THREE.DataTexture {
  if (cached) return cached
  const h = 64
  const data = new Uint8Array(4 * h)
  for (let y = 0; y < h; y++) {
    // Normal-Map-Kodierung: 127 = neutral; y-Komponente folgt der
    // Raupenwölbung, z bleibt dominant (dezente Ausprägung)
    const ny = Math.round(127 + 96 * Math.sin((y / h) * Math.PI * 2))
    const o = y * 4
    data[o] = 127
    data[o + 1] = ny
    data[o + 2] = 220
    data[o + 3] = 255
  }
  const tex = new THREE.DataTexture(data, 1, h)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  cached = tex
  return tex
}
