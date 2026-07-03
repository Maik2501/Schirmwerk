/**
 * Startdesign und Standard-Auflösungen.
 *
 * Das Startdesign ist an unser Referenzfoto angelehnt: bauchiger Tropfen,
 * 10 tiefe Hauptwellen, feine gegenläufige Ripples, kräftiger Twist,
 * E27-Hals. Maße passen bequem auf einen Bambu Lab P1S (256×256×256 mm).
 */
import type { Resolution, ShadeParams } from './types'
import { SOCKETS } from './sockets'

export function defaultShadeParams(): ShadeParams {
  return {
    heightMm: 170,
    profile: {
      preset: 'tropfen',
      bottomRadiusMm: 46,
      topRadiusMm: 26,
      shapeAmount: 0.65,
    },
    waves: {
      n1: 10,
      a1: 0.16,
      n2: 22,
      a2: 0.035,
      twistDeg: 70,
      phase1Rad: 0,
      phase2Rad: 0,
    },
    neck: {
      socket: 'e27',
      holeDiameterMm: SOCKETS.e27.holeDiameterMm,
      extraClearanceMm: 0.4,
      heightMm: 12,
      blendMm: 30,
    },
    footBlendMm: 8,
  }
}

/** Vorschau: flüssig auf Mittelklasse-GPUs (~77k Dreiecke Mantel) */
export const PREVIEW_RESOLUTION: Resolution = { thetaSegments: 192, zSegments: 200 }

/** Export: fein genug, dass Facetten unter der Schichttextur verschwinden */
export const EXPORT_RESOLUTION: Resolution = { thetaSegments: 512, zSegments: 800 }
