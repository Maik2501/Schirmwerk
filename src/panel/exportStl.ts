/**
 * Browser-Glue für den Modell-Export: Export-Mesh bauen (immer mit
 * Deckeln, siehe BuildOptions in geometry/types.ts), als STL oder 3MF
 * verpacken und als Datei-Download anstoßen. Die Rechenarbeit passiert
 * synchron auf dem Main-Thread (~1 s bei 512×800) – der Button zeigt
 * solange „Rechne …“. Das Geometrie-Modul ist Worker-tauglich; sollte
 * die Auflösung später weiter steigen, wandert genau dieser Aufruf in
 * einen Web Worker.
 */
import { buildShadeMesh } from '../geometry/mesh'
import { meshToBinaryStl } from '../geometry/stl'
import { meshTo3mf } from '../geometry/threeMf'
import type { Resolution, ShadeParams } from '../geometry/types'

export type ExportFormat = 'stl' | '3mf'

/** Dateiname aus Form, Höhe und Druckvariante, z. B. schirmwerk-tropfen-h170mm.stl */
export function modelFileName(params: ShadeParams, format: ExportFormat): string {
  const form = params.profile.mode === 'preset' ? params.profile.preset : params.profile.mode
  const variante = params.neckPosition === 'bottom' ? '-kragen-unten' : ''
  return `schirmwerk-${form}-h${Math.round(params.heightMm)}mm${variante}.${format}`
}

/** Baut das Modell im gewünschten Format und startet den Download. */
export async function downloadModel(
  params: ShadeParams,
  res: Resolution,
  format: ExportFormat,
): Promise<number> {
  const mesh = buildShadeMesh(params, res, { caps: true })
  const buffer = format === 'stl' ? meshToBinaryStl(mesh) : await meshTo3mf(mesh)
  const blob = new Blob([buffer], { type: format === 'stl' ? 'model/stl' : 'model/3mf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = modelFileName(params, format)
  a.click()
  // verzögert freigeben – sofortiges revoke bricht in manchen Browsern
  // den gerade gestarteten Download ab
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return buffer.byteLength
}
