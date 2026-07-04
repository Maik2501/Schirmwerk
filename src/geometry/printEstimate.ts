/**
 * Druckzeit- und Material-Schätzung für Vase-Mode.
 *
 * Die Spirale ist EINE durchgehende Bahn – ihre Gesamtlänge ist praktisch
 * die Summe der Konturumfänge aller Schichten. Wir tasten den Umfang auf
 * zSegments Höhen ab (Polygonlänge der Kontur inkl. Wellen!), mitteln und
 * multiplizieren mit der Schichtanzahl. Material = Bahnlänge × Linien-
 * querschnitt (Rechteck-Näherung wie im Slicer), Zeit = Bahnlänge / Tempo.
 * Bewusst eine Schätzung: Beschleunigung, Anlauf und erste Schicht
 * ignorieren wir – die Größenordnung stimmt trotzdem verlässlich.
 */
import type { Resolution, ShadeParams } from './types'
import { radiusAt, TWO_PI } from './surface'

export interface PrintAssumptions {
  layerHeightMm: number
  lineWidthMm: number
  speedMmS: number
  /** PETG ≈ 1,27 g/cm³ */
  densityGCm3: number
}

export const DEFAULT_PRINT_ASSUMPTIONS: PrintAssumptions = {
  layerHeightMm: 0.2,
  lineWidthMm: 0.42,
  speedMmS: 80,
  densityGCm3: 1.27,
}

export interface PrintEstimate {
  /** Länge der Druckbahn, Meter */
  lengthM: number
  /** Filamentbedarf, Gramm */
  grams: number
  /** reine Bahnzeit, Minuten */
  minutes: number
}

export function estimateVasePrint(
  params: ShadeParams,
  res: Resolution = { thetaSegments: 192, zSegments: 96 },
  a: PrintAssumptions = DEFAULT_PRINT_ASSUMPTIONS,
): PrintEstimate {
  const N = Math.max(8, Math.floor(res.thetaSegments))
  const R = Math.max(2, Math.floor(res.zSegments))

  // mittlerer Konturumfang (Polygonlänge, kartesisch inkl. Naht-Schluss)
  let sum = 0
  for (let row = 0; row <= R; row++) {
    const z = (row / R) * params.heightMm
    let len = 0
    let px = 0
    let py = 0
    let firstX = 0
    let firstY = 0
    for (let col = 0; col < N; col++) {
      const theta = (col / N) * TWO_PI
      const r = radiusAt(params, theta, z)
      const x = r * Math.cos(theta)
      const y = r * Math.sin(theta)
      if (col === 0) {
        firstX = x
        firstY = y
      } else {
        len += Math.hypot(x - px, y - py)
      }
      px = x
      py = y
    }
    len += Math.hypot(firstX - px, firstY - py)
    sum += len
  }
  const meanCircumference = sum / (R + 1)

  const layers = params.heightMm / a.layerHeightMm
  const lengthMm = meanCircumference * layers
  const volumeMm3 = lengthMm * a.lineWidthMm * a.layerHeightMm

  return {
    lengthM: lengthMm / 1000,
    grams: (volumeMm3 / 1000) * a.densityGCm3,
    minutes: lengthMm / a.speedMmS / 60,
  }
}
