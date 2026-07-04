/**
 * Browser-Glue für den STL-Export: Export-Mesh bauen (immer mit Deckeln,
 * siehe BuildOptions in geometry/types.ts), als binäres STL verpacken und
 * als Datei-Download anstoßen. Die Rechenarbeit passiert synchron auf dem
 * Main-Thread (~1 s bei 512×800) – der Button zeigt solange „Rechne …“.
 * Das Geometrie-Modul ist Worker-tauglich; sollte die Auflösung später
 * weiter steigen, wandert genau dieser Aufruf in einen Web Worker.
 */
import { buildShadeMesh } from '../geometry/mesh'
import { meshToBinaryStl } from '../geometry/stl'
import type { Resolution, ShadeParams } from '../geometry/types'

/** Dateiname aus Form und Höhe, z. B. schirmwerk-tropfen-h170mm.stl */
export function stlFileName(params: ShadeParams): string {
  const form = params.profile.mode === 'preset' ? params.profile.preset : params.profile.mode
  return `schirmwerk-${form}-h${Math.round(params.heightMm)}mm.stl`
}

/** Baut das STL und startet den Download. Liefert die Dateigröße in Byte. */
export function downloadStl(params: ShadeParams, res: Resolution): number {
  const mesh = buildShadeMesh(params, res, { caps: true })
  const stl = meshToBinaryStl(mesh)
  const blob = new Blob([stl], { type: 'model/stl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = stlFileName(params)
  a.click()
  // verzögert freigeben – sofortiges revoke bricht in manchen Browsern
  // den gerade gestarteten Download ab
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return stl.byteLength
}
