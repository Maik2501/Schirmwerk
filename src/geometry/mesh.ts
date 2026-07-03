/**
 * Baut das Schirm-Mesh als indiziertes Dreiecksnetz.
 *
 * Vertex-Gitter: (zSegments+1) Ringe × thetaSegments Spalten. Die Naht bei
 * θ = 2π verwendet per Modulo dieselben Vertices wie θ = 0 – es gibt also
 * keine doppelte Naht, die Mantelfläche ist von Haus aus dicht und die
 * Normalen sind über die Naht hinweg glatt.
 *
 * Mit caps = true kommen zwei Fächer-Deckel dazu (je ein Mittelpunkt-Vertex
 * plus der Rand-Ring). Weil r(θ,z) > 0 in Polarform schnittfreie Konturen
 * garantiert (siehe surface.ts), ist der Fächer immer eine gültige, planare
 * Triangulierung. Die Deckel teilen sich die Rand-Vertices mit dem Mantel →
 * ein echtes 2-mannigfaltiges Netz: jede Kante liegt in genau 2 Dreiecken,
 * Euler-Charakteristik V − E + F = 2. Genau das prüfen die Tests.
 *
 * Windung: gegen den Uhrzeigersinn von außen gesehen → Normalen zeigen nach
 * außen, der Boden-Deckel nach unten (−z), der Hals-Deckel nach oben (+z).
 * Dieselbe Funktion erzeugt Vorschau- (caps=false, grob) und Export-Mesh
 * (caps=true, fein) – nur die Auflösung unterscheidet sich.
 */
import type { BuildOptions, MeshData, Resolution, ShadeParams } from './types'
import { TWO_PI, radiusAt } from './surface'

export function buildShadeMesh(
  params: ShadeParams,
  res: Resolution,
  opts: BuildOptions = { caps: true },
): MeshData {
  const N = Math.max(3, Math.floor(res.thetaSegments))
  const R = Math.max(1, Math.floor(res.zSegments))
  const H = params.heightMm

  // --- 1) Radien-Gitter einmal abtasten (alle weiteren Schritte lesen nur) ---
  const radii = new Float64Array((R + 1) * N)
  for (let row = 0; row <= R; row++) {
    const z = (row / R) * H
    for (let col = 0; col < N; col++) {
      radii[row * N + col] = radiusAt(params, (col / N) * TWO_PI, z)
    }
  }

  // cos/sin je Spalte vorberechnen (wird je Ring wiederverwendet)
  const cosCol = new Float64Array(N)
  const sinCol = new Float64Array(N)
  for (let col = 0; col < N; col++) {
    const theta = (col / N) * TWO_PI
    cosCol[col] = Math.cos(theta)
    sinCol[col] = Math.sin(theta)
  }

  const mantleVerts = (R + 1) * N
  const vertCount = mantleVerts + (opts.caps ? 2 : 0)
  const positions = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)

  // --- 2) Positionen: Zylinderkoordinaten → kartesisch (z bleibt Höhe) ---
  for (let row = 0; row <= R; row++) {
    const z = (row / R) * H
    for (let col = 0; col < N; col++) {
      const r = radii[row * N + col]
      const i = (row * N + col) * 3
      positions[i] = r * cosCol[col]
      positions[i + 1] = r * sinCol[col]
      positions[i + 2] = z
    }
  }

  // --- 3) Normalen aus zentralen Differenzen des Gitters ---
  // ∂r/∂θ über Nachbarspalten (mit Wrap), ∂r/∂z über Nachbarringe
  // (an den Enden einseitig). Normale n = p_θ × p_z wie in surface.ts.
  const dTheta = TWO_PI / N
  const dzRow = H / R
  for (let row = 0; row <= R; row++) {
    for (let col = 0; col < N; col++) {
      const r = radii[row * N + col]
      const rL = radii[row * N + ((col + N - 1) % N)]
      const rR = radii[row * N + ((col + 1) % N)]
      const rTh = (rR - rL) / (2 * dTheta)

      let rZ: number
      if (row === 0) rZ = (radii[N + col] - r) / dzRow
      else if (row === R) rZ = (r - radii[(R - 1) * N + col]) / dzRow
      else rZ = (radii[(row + 1) * N + col] - radii[(row - 1) * N + col]) / (2 * dzRow)

      const c = cosCol[col]
      const s = sinCol[col]
      const a1 = rTh * c - r * s
      const a2 = rTh * s + r * c
      const b1 = rZ * c
      const b2 = rZ * s
      let nx = a2
      let ny = -a1
      let nz = a1 * b2 - a2 * b1
      const invLen = 1 / Math.hypot(nx, ny, nz)
      nx *= invLen
      ny *= invLen
      nz *= invLen

      const i = (row * N + col) * 3
      normals[i] = nx
      normals[i + 1] = ny
      normals[i + 2] = nz
    }
  }

  // --- 4) Mantel-Indizes: je Gitterzelle zwei Dreiecke, CCW von außen ---
  const mantleTris = 2 * N * R
  const capTris = opts.caps ? 2 * N : 0
  const indices = new Uint32Array((mantleTris + capTris) * 3)
  let k = 0
  for (let row = 0; row < R; row++) {
    for (let col = 0; col < N; col++) {
      const colNext = (col + 1) % N
      const v00 = row * N + col
      const v01 = row * N + colNext
      const v10 = (row + 1) * N + col
      const v11 = (row + 1) * N + colNext
      indices[k++] = v00
      indices[k++] = v01
      indices[k++] = v11
      indices[k++] = v00
      indices[k++] = v11
      indices[k++] = v10
    }
  }

  // --- 5) Deckel: Fächer vom Mittelpunkt, Rand-Vertices werden geteilt ---
  if (opts.caps) {
    const centerBottom = mantleVerts
    const centerTop = mantleVerts + 1
    // Mittelpunkt unten (0,0,0), Normale nach unten
    positions[centerBottom * 3] = 0
    positions[centerBottom * 3 + 1] = 0
    positions[centerBottom * 3 + 2] = 0
    normals[centerBottom * 3] = 0
    normals[centerBottom * 3 + 1] = 0
    normals[centerBottom * 3 + 2] = -1
    // Mittelpunkt oben (0,0,H), Normale nach oben
    positions[centerTop * 3] = 0
    positions[centerTop * 3 + 1] = 0
    positions[centerTop * 3 + 2] = H
    normals[centerTop * 3] = 0
    normals[centerTop * 3 + 1] = 0
    normals[centerTop * 3 + 2] = 1

    for (let col = 0; col < N; col++) {
      const colNext = (col + 1) % N
      // Boden: von unten betrachtet CCW → Windung (Center, next, col)
      indices[k++] = centerBottom
      indices[k++] = colNext
      indices[k++] = col
      // Hals-Deckel: von oben betrachtet CCW → Windung (Center, col, next)
      indices[k++] = centerTop
      indices[k++] = R * N + col
      indices[k++] = R * N + colNext
    }
  }

  return { positions, normals, indices }
}

/**
 * Signiertes Volumen des Netzes (Divergenzsatz über Tetraeder zum Ursprung):
 * V = Σ det(v0, v1, v2) / 6. Positiv bei konsistent nach außen orientierten
 * Normalen – dient den Tests als Orientierungs-Nachweis.
 */
export function signedVolume(mesh: MeshData): number {
  const { positions: p, indices } = mesh
  let vol = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3
    const b = indices[t + 1] * 3
    const c = indices[t + 2] * 3
    const ax = p[a], ay = p[a + 1], az = p[a + 2]
    const bx = p[b], by = p[b + 1], bz = p[b + 2]
    const cx = p[c], cy = p[c + 1], cz = p[c + 2]
    vol +=
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx)
  }
  return vol / 6
}
