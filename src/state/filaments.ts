/**
 * Filament-Stammdaten für die Vorschau-Einfärbung.
 *
 * Die Hex-Werte sind die offiziellen Bambu-Lab-Farbcodes der Linie
 * „PETG Translucent“ (Hex Code Table der Produktseite, Stand 07/2026,
 * von zwei Händler-Datenblättern identisch bestätigt). „Klar“ steht für
 * ungefärbtes/Basic-transparentes PETG und entspricht der neutralen
 * Studio-Optik – Weiß tönt im Physical-Material schlicht gar nicht.
 */
export interface FilamentColor {
  id: string
  /** Anzeigename (Bambu-Produktname bzw. „Klar“) */
  name: string
  /** offizieller Bambu-Hex-Farbcode */
  hex: string
  /**
   * Geschätzte Licht-Durchlässigkeit 0..1 – HEURISTIK aus Pigmentdichte
   * und Erfahrungswerten, keine Messwerte. Steuert in der Vorschau
   * Transmission und Rauheit (dunkler pigmentiert = trüber).
   */
  td: number
}

export const PETG_TRANSLUCENT: FilamentColor[] = [
  { id: 'clear', name: 'Klar', hex: '#ffffff', td: 0.97 },
  { id: 'gray', name: 'Translucent Gray', hex: '#8E8E8E', td: 0.78 },
  { id: 'light-blue', name: 'Translucent Light Blue', hex: '#61B0FF', td: 0.9 },
  { id: 'olive', name: 'Translucent Olive', hex: '#748C45', td: 0.82 },
  { id: 'brown', name: 'Translucent Brown', hex: '#C9A381', td: 0.85 },
  { id: 'teal', name: 'Translucent Teal', hex: '#77EDD7', td: 0.92 },
  { id: 'orange', name: 'Translucent Orange', hex: '#FF911A', td: 0.9 },
  { id: 'purple', name: 'Translucent Purple', hex: '#D6ABFF', td: 0.93 },
  { id: 'pink', name: 'Translucent Pink', hex: '#F9C1BD', td: 0.92 },
]
