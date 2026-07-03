/**
 * Kern der Formfindung: die parametrische Fläche r(θ, z).
 *
 *   r(θ,z) = mix( P(z) · [ 1 + F(z)·W(θ,z) ],   R_Hals,   S(z) )
 *
 *   W(θ,z) = a1·sin( n1·(θ − τ(z)) + φ1 )  +  a2·sin( n2·(θ + τ(z)) + φ2 )
 *
 * Bausteine:
 * - P(z): Grundprofil (siehe profile.ts).
 * - W(θ,z): Haupt- plus Sekundärwellen, Amplituden relativ zum lokalen
 *   Profilradius (Wellen skalieren also mit – dort wo der Schirm dick ist,
 *   sind auch die Wellen tief, wie beim Referenzfoto).
 * - τ(z) = deg2rad(twistDeg)·(z/H): Der Twist rotiert das Muster.
 *   Wichtig: Wir verdrehen θ selbst (θ − τ) statt nur die Phase zu schieben.
 *   So bedeutet „Twist 90°“ wirklich: die Wellenberge oben stehen 90°
 *   verdreht gegenüber unten – unabhängig von der Wellenzahl n.
 *   Die Sekundärwellen laufen gegenläufig (θ + τ), das ergibt den
 *   „geflochtenen“ Look aus dem Briefing.
 * - F(z): Fuß-Blend, smoothstep 0→1 über footBlendMm. Lässt die Wellen am
 *   Bett rund starten (Betthaftung, sauberer unterer Rand).
 * - S(z): Hals-Blend, smoothstep 0→1 über die Blendzone unterhalb des
 *   Kragens. Blendet Radius UND Wellen gemeinsam auf den zylindrischen
 *   Halsradius – C1-stetig, kein Knick am Kragen.
 *
 * Druckbarkeits-Eigenschaft: Solange r(θ,z) > 0 ist, kann sich eine
 * Schichtkontur in Polarform nicht selbst schneiden (jeder Strahl vom
 * Zentrum trifft die Kontur genau einmal). r > 0 ist damit unser
 * Selbstschnitt-Kriterium, und Fächer-Deckel vom Mittelpunkt aus sind
 * garantiert gültig.
 */
import type { NeckParams, Resolution, ShadeParams } from './types'
import { evalProfile } from './profile'

export const DEG2RAD = Math.PI / 180
export const TWO_PI = Math.PI * 2

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Hermite-Smoothstep: 0 unterhalb edge0, 1 oberhalb edge1, dazwischen C1-glatt. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Innenradius des Halses: Nennloch plus Toleranz, halbiert. */
export function neckRadiusMm(neck: NeckParams): number {
  return (neck.holeDiameterMm + neck.extraClearanceMm) / 2
}

/** Radius der Fläche an (θ, z). θ in Radiant, z in mm. */
export function radiusAt(params: ShadeParams, theta: number, z: number): number {
  const H = params.heightMm
  const { n1, a1, n2, a2, twistDeg, phase1Rad, phase2Rad } = params.waves

  // Muster-Rotation mit der Höhe (Twist), Sekundärwellen gegenläufig
  const tau = twistDeg * DEG2RAD * (z / H)
  const wave =
    a1 * Math.sin(n1 * (theta - tau) + phase1Rad) +
    a2 * Math.sin(n2 * (theta + tau) + phase2Rad)

  // Fuß-Blend: Wellen laufen über footBlendMm weich ein
  const foot = smoothstep(0, params.footBlendMm, z)
  const body = evalProfile(params.profile, z / H) * (1 + foot * wave)

  // Hals-Blend: unterhalb des Kragens weich auf den Halsradius übergehen
  const neckStart = H - params.neck.heightMm
  const s = smoothstep(neckStart - params.neck.blendMm, neckStart, z)
  return body * (1 - s) + neckRadiusMm(params.neck) * s
}

/**
 * Überhangwinkel gegenüber der Vertikalen an (θ, z), in Grad.
 * 0° = senkrechte Wand, 90° = horizontale Decke.
 *
 * Herleitung: Flächenpunkt p(θ,z) = (r·cosθ, r·sinθ, z). Die nach außen
 * zeigende Normale ist n = ∂p/∂θ × ∂p/∂z. Der Überhang folgt aus der
 * z-Komponente der Einheitsnormalen: β = asin(−n_z).
 * Nur nach unten geneigte Flächen (n_z < 0, Wand lehnt nach außen) zählen –
 * nach innen geneigte Wände stützt die jeweils vorherige Schicht.
 * Weil r über radiusAt abgeleitet wird, fließt auch der Twist korrekt ein.
 * Vase Mode druckt bis ~45–50° zuverlässig, darüber wird es kritisch.
 */
export function overhangAngleDeg(params: ShadeParams, theta: number, z: number): number {
  const H = params.heightMm
  const dTh = 1e-3 // rad, für zentrale Differenzen
  const dz = Math.min(0.5, H / 1000) // mm
  const zc = clamp(z, dz, H - dz)

  const r = radiusAt(params, theta, zc)
  const rTh = (radiusAt(params, theta + dTh, zc) - radiusAt(params, theta - dTh, zc)) / (2 * dTh)
  const rZ = (radiusAt(params, theta, zc + dz) - radiusAt(params, theta, zc - dz)) / (2 * dz)

  const c = Math.cos(theta)
  const s = Math.sin(theta)
  // p_θ = (rTh·c − r·s, rTh·s + r·c, 0), p_z = (rZ·c, rZ·s, 1)
  const a1 = rTh * c - r * s
  const a2 = rTh * s + r * c
  const b1 = rZ * c
  const b2 = rZ * s
  // n = p_θ × p_z
  const nx = a2
  const ny = -a1
  const nz = a1 * b2 - a2 * b1
  const len = Math.hypot(nx, ny, nz)
  if (len === 0) return 0
  return Math.asin(clamp(-nz / len, 0, 1)) / DEG2RAD
}

/** Kleinster Radius auf einem Abtast-Gitter – muss für druckbare Formen > 0 sein. */
export function sampleMinRadius(params: ShadeParams, res: Resolution): number {
  let min = Infinity
  for (let row = 0; row <= res.zSegments; row++) {
    const z = (row / res.zSegments) * params.heightMm
    for (let col = 0; col < res.thetaSegments; col++) {
      const r = radiusAt(params, (col / res.thetaSegments) * TWO_PI, z)
      if (r < min) min = r
    }
  }
  return min
}
