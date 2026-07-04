/**
 * 3MF-Writer: OPC-Paket (ZIP) mit dem 3D-Modell als XML.
 *
 * 3MF ist gegenüber STL das „sprechende“ Format: Einheit steht explizit
 * drin (millimeter), das Netz ist indiziert (Vertices werden geteilt statt
 * je Dreieck kopiert) und Slicer wie Bambu Studio öffnen es nativ.
 * Wir schreiben das Minimalpaket der Core-Spezifikation:
 *   [Content_Types].xml · _rels/.rels · 3D/3dmodel.model
 */
import type { MeshData } from './types'
import { buildZip } from './zip'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

/** Nur das Modell-XML – separat exportiert, damit Tests es pur prüfen können. */
export function modelXml(mesh: MeshData, title = 'Schirmwerk Lampenschirm'): string {
  const { positions: p, indices } = mesh
  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n')
  parts.push(
    '<model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
  )
  parts.push(` <metadata name="Title">${title}</metadata>\n`)
  parts.push(' <resources>\n  <object id="1" type="model">\n   <mesh>\n    <vertices>\n')
  for (let i = 0; i < p.length; i += 3) {
    // 3 Nachkommastellen = 1 µm Auflösung, hält das XML kompakt
    parts.push(`     <vertex x="${p[i].toFixed(3)}" y="${p[i + 1].toFixed(3)}" z="${p[i + 2].toFixed(3)}"/>\n`)
  }
  parts.push('    </vertices>\n    <triangles>\n')
  for (let t = 0; t < indices.length; t += 3) {
    parts.push(`     <triangle v1="${indices[t]}" v2="${indices[t + 1]}" v3="${indices[t + 2]}"/>\n`)
  }
  parts.push('    </triangles>\n   </mesh>\n  </object>\n </resources>\n')
  parts.push(' <build>\n  <item objectid="1"/>\n </build>\n</model>\n')
  return parts.join('')
}

/** Verpackt das Mesh als komplettes 3MF (ZIP mit DEFLATE). */
export async function meshTo3mf(mesh: MeshData): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(RELS) },
    { name: '3D/3dmodel.model', data: encoder.encode(modelXml(mesh)) },
  ])
}
