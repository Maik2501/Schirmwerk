/**
 * Grundprofil P(z): der Radius über die Höhe, ohne Wellen.
 *
 * Umgesetzt als kubische Bezier-Kurve im Radius-Raum:
 *
 *   P(t) = (1−t)³·r0 + 3(1−t)²t·r1 + 3(1−t)t²·r2 + t³·r3,   t = z/H ∈ [0,1]
 *
 * r0 und r3 sind die vom Nutzer gewählten Radien unten/oben, die Presets
 * setzen nur die beiden inneren Kontrollradien r1/r2. Vorteile:
 * - stetig differenzierbar (keine Knicke → keine Überhang-Sprünge),
 * - Endpunkte werden exakt getroffen (Bezier-Eigenschaft),
 * - später direkt durch einen frei editierbaren Bezier-Editor ersetzbar.
 */
import type { ProfileParams } from './types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Liefert die vier Kontrollradien [r0, r1, r2, r3] für ein Preset. */
export function profileControlRadii(profile: ProfileParams): [number, number, number, number] {
  const { preset, bottomRadiusMm: r0, topRadiusMm: r3, shapeAmount: s } = profile
  switch (preset) {
    case 'zylinder':
    case 'konus':
      // Gerade Linie von unten nach oben; Zylinder = gleiche Radien.
      // (Beide Presets teilen sich die Kurve, sie unterscheiden sich nur
      // in den Default-Radien, die das UI setzt.)
      return [r0, lerp(r0, r3, 1 / 3), lerp(r0, r3, 2 / 3), r3]
    case 'tropfen': {
      // Bauchig/Tropfen: r1 drückt die Kurve im unteren Drittel nach außen,
      // r2 zieht sie sanft zum Hals. shapeAmount skaliert den Bauch.
      const belly = Math.max(r0, r3) * (1 + 0.9 * s)
      return [r0, belly, lerp(r0, r3, 0.7), r3]
    }
    case 'glocke': {
      // Glocke: weiter Saum unten, der schnell einzieht (konkaver Fuß),
      // oben eine leichte Schulter unterm Hals.
      const skirt = r0 * (1 - 0.55 * s)
      const shoulder = r3 * (1 + 0.35 * s)
      return [r0, skirt, shoulder, r3]
    }
  }
}

/** Wertet das Profil an t = z/H ∈ [0,1] aus. */
export function evalProfile(profile: ProfileParams, t: number): number {
  const [r0, r1, r2, r3] = profileControlRadii(profile)
  const u = 1 - t
  return u * u * u * r0 + 3 * u * u * t * r1 + 3 * u * t * t * r2 + t * t * t * r3
}
