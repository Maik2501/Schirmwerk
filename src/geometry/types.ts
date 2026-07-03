/**
 * Zentrale Typen des Geometrie-Moduls.
 *
 * Konventionen:
 * - Alle Längen in Millimetern (STL wird 1:1 in mm exportiert).
 * - z ist die Höhenachse: z = 0 liegt auf dem Druckbett (Unterkante),
 *   z = heightMm ist die Oberkante des Halses. Slicer erwarten Z-oben.
 * - Winkel im UI in Grad, intern in Radiant.
 * - Dieses Modul ist bewusst framework-frei (kein React-/three.js-Import),
 *   damit es pur testbar ist und in einem Web Worker laufen kann.
 */

export type ProfilePreset = 'zylinder' | 'konus' | 'tropfen' | 'glocke'

export type SocketType = 'e14' | 'e27' | 'custom'

export interface ProfileParams {
  preset: ProfilePreset
  /** Radius an der Unterkante (liegt beim Druck auf dem Bett), mm */
  bottomRadiusMm: number
  /** Radius am oberen Profilende, kurz vor der Hals-Blendzone, mm */
  topRadiusMm: number
  /** Ausprägung der Preset-Form (Bauch bzw. Glockenschwung), 0..1 */
  shapeAmount: number
}

export interface WaveParams {
  /** Hauptwellen pro Umdrehung – ganzzahlig, sonst entsteht bei θ=0 eine Naht */
  n1: number
  /** Amplitude der Hauptwellen, relativ zum lokalen Profilradius (0.15 = ±15 %) */
  a1: number
  /** Feine Sekundärwellen (Ripple) pro Umdrehung – ganzzahlig */
  n2: number
  /** Amplitude der Sekundärwellen, relativ */
  a2: number
  /**
   * Gesamtverdrehung des Wellenmusters über die Höhe, in Grad.
   * Positiv = gegen den Uhrzeigersinn (von oben gesehen), negativ erlaubt.
   * Die Sekundärwellen drehen automatisch gegenläufig („geflochtener“ Look).
   */
  twistDeg: number
  /** Phasenlage der Wellen in Radiant – genutzt von Zufalls-Varianten */
  phase1Rad: number
  phase2Rad: number
}

export interface NeckParams {
  socket: SocketType
  /** Nennloch für den Fassungs-Schraubring, mm (E27 ≈ 40, E14 ≈ 28.5) */
  holeDiameterMm: number
  /** Zusätzliches Spiel auf den Durchmesser (Drucktoleranz), mm */
  extraClearanceMm: number
  /** Höhe des zylindrischen Kragens, mm */
  heightMm: number
  /**
   * Höhe der Blendzone direkt unterhalb des Kragens, mm.
   * Darin gehen Profilradius UND Wellenamplitude weich (smoothstep, C1-stetig)
   * in den zylindrischen Hals über, damit der Kragen sauber rund wird.
   */
  blendMm: number
}

export interface ShadeParams {
  /** Gesamthöhe des Schirms inklusive Hals, mm */
  heightMm: number
  profile: ProfileParams
  waves: WaveParams
  neck: NeckParams
  /**
   * Fuß-Blend: Höhe über dem Bett, auf der die Wellen von 0 einlaufen, mm.
   * Runde erste Schichten haften besser und geben einen sauberen Rand
   * (bei Vase-Mode-Referenzdrucken gut zu sehen). 0 = Wellen bis ganz unten.
   */
  footBlendMm: number
}

export interface Resolution {
  /** Segmente um den Umfang (θ-Richtung) */
  thetaSegments: number
  /** Segmente über die Höhe (z-Richtung) */
  zSegments: number
}

/** Rohes Dreiecksnetz – Framework-frei, direkt in three.js oder STL verwendbar */
export interface MeshData {
  /** xyz je Vertex, mm; z ist die Höhe */
  positions: Float32Array
  /** Einheitsnormalen je Vertex, nach außen orientiert */
  normals: Float32Array
  /** 3 Vertex-Indizes je Dreieck, gegen den Uhrzeigersinn von außen gesehen */
  indices: Uint32Array
}

export interface BuildOptions {
  /**
   * true  = Deckel oben und unten → wasserdichter Solid (Export).
   *         Die Öffnungen entstehen erst im Slicer: Vase Mode lässt oben
   *         offen, 0 Bodenschichten öffnen die Unterseite.
   * false = offene Mantelfläche (Vorschau, man sieht ins Innere).
   */
  caps: boolean
}
