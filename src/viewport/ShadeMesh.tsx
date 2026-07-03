/**
 * Der Schirm im Viewport: MeshData aus dem Geometrie-Modul → BufferGeometry.
 * Für die Vorschau bauen wir OHNE Deckel (caps: false) und rendern DoubleSide –
 * so sieht man ins offene Innere, genau wie beim echten Vase-Mode-Druck.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildShadeMesh } from '../geometry/mesh'
import { useStudio } from '../state/store'

export function ShadeMesh() {
  const params = useStudio((s) => s.params)
  const res = useStudio((s) => s.previewRes)

  const geometry = useMemo(() => {
    const data = buildShadeMesh(params, res, { caps: false })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    g.setIndex(new THREE.BufferAttribute(data.indices, 1))
    return g
  }, [params, res])

  // alte Geometrie freigeben, sobald eine neue existiert
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      {/*
        Transparentes PETG in Vase-Mode-Optik: Transmission statt Alpha –
        das Material bricht/streut, was dahinter liegt (auch die Glühbirne).
        Die leichte Rauheit simuliert die matte Schichttextur des Drucks.
        ior 1.57 ≈ PET. Feintuning am lebenden Objekt beim Checkpoint.
      */}
      <meshPhysicalMaterial
        color="#ffffff"
        metalness={0}
        roughness={0.38}
        transmission={1}
        thickness={0.9}
        ior={1.57}
        clearcoat={0.3}
        clearcoatRoughness={0.55}
        envMapIntensity={1.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
