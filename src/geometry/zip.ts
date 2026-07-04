/**
 * Minimaler ZIP-Writer für den 3MF-Export – framework-frei.
 *
 * Einträge werden mit DEFLATE (Methode 8) über die browser-/Node-native
 * CompressionStream-API komprimiert; ein unkomprimiertes 3MF wäre bei
 * Export-Auflösung ~90 MB XML. CRC32 läuft über die UNkomprimierten
 * Daten (ZIP-Spezifikation). Zeitstempel sind fix auf 0 gesetzt –
 * deterministische Bytes, reproduzierbare Tests.
 */

/** IEEE-CRC32 (reflected), Tabelle einmalig aufgebaut. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Baut ein ZIP (alle Einträge DEFLATE) als ArrayBuffer. */
export async function buildZip(entries: ZipEntry[]): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const parts: { nameBytes: Uint8Array; crc: number; size: number; comp: Uint8Array; offset: number }[] = []

  let offset = 0
  const chunks: Uint8Array[] = []
  const push = (u8: Uint8Array) => {
    chunks.push(u8)
    offset += u8.length
  }
  const le = (bytes: number, value: number) => {
    const u8 = new Uint8Array(bytes)
    for (let i = 0; i < bytes; i++) u8[i] = (value >>> (8 * i)) & 0xff
    return u8
  }

  // --- Local File Headers + Daten ---
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const comp = await deflateRaw(entry.data)
    parts.push({ nameBytes, crc, size: entry.data.length, comp, offset })

    push(le(4, 0x04034b50)) // Signatur
    push(le(2, 20)) // Version needed
    push(le(2, 0)) // Flags
    push(le(2, 8)) // Methode: DEFLATE
    push(le(4, 0)) // DOS-Zeit/-Datum: fix 0 (deterministisch)
    push(le(4, crc))
    push(le(4, comp.length))
    push(le(4, entry.data.length))
    push(le(2, nameBytes.length))
    push(le(2, 0)) // Extra-Länge
    push(nameBytes)
    push(comp)
  }

  // --- Central Directory ---
  const cdStart = offset
  for (const p of parts) {
    push(le(4, 0x02014b50))
    push(le(2, 20)) // Version made by
    push(le(2, 20)) // Version needed
    push(le(2, 0))
    push(le(2, 8))
    push(le(4, 0))
    push(le(4, p.crc))
    push(le(4, p.comp.length))
    push(le(4, p.size))
    push(le(2, p.nameBytes.length))
    push(le(2, 0)) // Extra
    push(le(2, 0)) // Kommentar
    push(le(2, 0)) // Disk
    push(le(2, 0)) // Interne Attribute
    push(le(4, 0)) // Externe Attribute
    push(le(4, p.offset))
    push(p.nameBytes)
  }
  const cdSize = offset - cdStart

  // --- End of Central Directory ---
  push(le(4, 0x06054b50))
  push(le(2, 0))
  push(le(2, 0))
  push(le(2, parts.length))
  push(le(2, parts.length))
  push(le(4, cdSize))
  push(le(4, cdStart))
  push(le(2, 0))

  const out = new Uint8Array(offset)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out.buffer
}
