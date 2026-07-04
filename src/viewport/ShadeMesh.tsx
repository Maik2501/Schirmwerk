/**
 * Der Schirm im Viewport: MeshData aus dem Geometrie-Modul → BufferGeometry.
 * Für die Vorschau bauen wir OHNE Deckel (caps: false) und rendern DoubleSide –
 * so sieht man ins offene Innere, genau wie beim echten Vase-Mode-Druck.
 *
 * Material-Realismus:
 * - UVs (u = θ/2π, v = z/H) entstehen hier aus dem bekannten Gitterlayout –
 *   das Geometrie-Modul bleibt UV-frei, STL braucht keine.
 * - Layerlinien: prozedurale Normal-Map, repeat.y = H/Schichthöhe → eine
 *   Druckraupe pro 0,2 mm, maßstabsecht.
 * - Filament-Durchlässigkeit (td, Heuristik): trübere Farben senken die
 *   Transmission und erhöhen die Rauheit.
 * - „Glas-Vorschau“: MeshTransmissionMaterial mit echter Brechung –
 *   deutlich GPU-lastiger, deshalb schaltbar (Standard aus).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { buildShadeMesh } from '../geometry/mesh'
import { useStudio } from '../state/store'
import { LAYER_HEIGHT_MM, layerNormalTexture } from './layerTexture'

/** warmes Grundlicht für den Transmission-Pass der Glas-Vorschau */
const GLASS_BACKGROUND = new THREE.Color('#5a4a38')

export function ShadeMesh() {
  const params = useStudio((s) => s.params)
  const res = useStudio((s) => s.previewRes)
  const shadeColor = useStudio((s) => s.shadeColor)
  const layerLines = useStudio((s) => s.layerLines)
  const glassPreview = useStudio((s) => s.glassPreview)

  const geometry = useMemo(() => {
    const data = buildShadeMesh(params, res, { caps: false })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    g.setIndex(new THREE.BufferAttribute(data.indices, 1))

    // UVs aus dem Gitterlayout des Builders: (zSegments+1) Ringe × N Spalten
    const N = Math.max(3, Math.floor(res.thetaSegments))
    const R = Math.max(1, Math.floor(res.zSegments))
    const uv = new Float32Array((R + 1) * N * 2)
    for (let row = 0; row <= R; row++) {
      for (let col = 0; col < N; col++) {
        const i = (row * N + col) * 2
        uv[i] = col / N
        uv[i + 1] = row / R
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return g
  }, [params, res])

  // alte Geometrie freigeben, sobald eine neue existiert
  useEffect(() => () => geometry.dispose(), [geometry])

  // Layerlinien: eine Raupe pro Schichthöhe, unabhängig von der Modellhöhe
  const normalMap = layerLines ? layerNormalTexture() : null
  useEffect(() => {
    if (normalMap) normalMap.repeat.set(1, params.heightMm / LAYER_HEIGHT_MM)
  }, [normalMap, params.heightMm])

  // Trübung aus der Filament-Heuristik: weniger Transmission, mehr Rauheit
  const td = shadeColor.td
  const transmission = 0.55 + 0.45 * td
  const roughness = 0.38 + (1 - td) * 0.45

  return (
    <mesh geometry={geometry}>
      {glassPreview ? (
        /*
          „Schön“-Modus: echte Brechung/Streuung über ein Transmission-FBO.
          transmission bleibt 1 (alles darunter rendert das FBO dunkel-opak),
          die Filament-Trübung kommt über Rauheit + anisotropen Blur.
          backside rendert die Rückwand der offenen Schale mit; auf die
          Layerlinien-Normal-Map verzichten wir hier – die 800+ Streifen
          aliasen im Transmission-Buffer zu dunklem Moiré.
        */
        <MeshTransmissionMaterial
          color={shadeColor.hex}
          // Milchglas statt poliertes Glas: hohe Rauheit + kräftiger Blur
          // verschmieren das Birnenlicht im Transmission-Pass zum weichen
          // Glühen – poliert-glatt liest die dünne Schale im dunklen Studio
          // nur als schwarze Spiegelfläche.
          roughness={0.35 + (1 - td) * 0.35}
          transmission={1}
          thickness={2.5}
          ior={1.57}
          chromaticAberration={0.02}
          anisotropicBlur={1.1}
          samples={8}
          resolution={512}
          backside
          backsideThickness={0.8}
          background={GLASS_BACKGROUND}
        />
      ) : (
        /*
          Standard: Physical-Material mit Transmission statt Alpha – schnell
          und stabil. ior 1.57 ≈ PET; color tönt Albedo UND Transmission,
          die Birne scheint also eingefärbt durch („Klar“ = keine Tönung).
        */
        <meshPhysicalMaterial
          color={shadeColor.hex}
          metalness={0}
          roughness={roughness}
          transmission={transmission}
          thickness={0.9}
          ior={1.57}
          clearcoat={0.3}
          clearcoatRoughness={0.55}
          envMapIntensity={1.35}
          normalMap={normalMap}
          normalScale={normalMap ? new THREE.Vector2(0.35, 0.35) : undefined}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  )
}
