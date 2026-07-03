/**
 * Übliche Maße für Lampenschirm-Aufnahmen (Schraubring auf der Fassung).
 *
 * Verifiziert gegen gängige Händlerangaben (Stand Juli 2026):
 * - E27: Lampenschirme/Gläser für E27-Fassungen brauchen ein Loch von 40 mm –
 *   das Schirmgewinde der E27-Fassung misst ca. 40 mm, Standard-Adapterringe
 *   (E27→E14) sind außen 42 mm und passen in 40-mm-Löcher.
 *   Quellen: textilkabel-fachhandel.de, stoffkabel.kaufen, click-licht.de.
 * - E14: Schirmgewinde ca. 28 mm; übliche Lochangaben liegen bei 28–30 mm.
 *   Wir starten mit 28.5 mm für etwas Spiel.
 *   Quellen: textilkabel-fachhandel.de, lampen-ersatzteile.de.
 *
 * Dazu kommt neck.extraClearanceMm (Default 0.4 mm) als Drucktoleranz:
 * PETG schwindet leicht, und die Vase-Mode-Bahn (~0.5–0.6 mm breit) liegt
 * mittig auf der Sollkontur – real wird das Loch also um etwa eine halbe
 * Bahnbreite enger als modelliert. Bei Bedarf Toleranz erhöhen.
 */
import type { SocketType } from './types'

export interface SocketSpec {
  label: string
  holeDiameterMm: number
}

export const SOCKETS: Record<Exclude<SocketType, 'custom'>, SocketSpec> = {
  e27: { label: 'E27', holeDiameterMm: 40.0 },
  e14: { label: 'E14', holeDiameterMm: 28.5 },
}
