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
}

export const PETG_TRANSLUCENT: FilamentColor[] = [
  { id: 'clear', name: 'Klar', hex: '#ffffff' },
  { id: 'gray', name: 'Translucent Gray', hex: '#8E8E8E' },
  { id: 'light-blue', name: 'Translucent Light Blue', hex: '#61B0FF' },
  { id: 'olive', name: 'Translucent Olive', hex: '#748C45' },
  { id: 'brown', name: 'Translucent Brown', hex: '#C9A381' },
  { id: 'teal', name: 'Translucent Teal', hex: '#77EDD7' },
  { id: 'orange', name: 'Translucent Orange', hex: '#FF911A' },
  { id: 'purple', name: 'Translucent Purple', hex: '#D6ABFF' },
  { id: 'pink', name: 'Translucent Pink', hex: '#F9C1BD' },
]
