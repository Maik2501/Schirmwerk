/**
 * Studio-Szene: dunkle Bühne, weiche Lichtflächen, Kontaktschatten.
 *
 * - Die Lichtumgebung ist aus Lightformern selbst gebaut (kein HDRI-Download,
 *   die App bleibt komplett offline-fähig und deterministisch).
 * - Modellkoordinaten haben z als Höhe (Slicer-Konvention); three.js rendert
 *   y-oben. Die Gruppe rotiert deshalb um −90° um x: Modell-z → Welt-y.
 * - Aufbau 'stehend': Die Lampe steht in NUTZ-Orientierung auf einem
 *   Holz-Puck – bei Kragenposition 'top' (kopfüber gedruckt) wird das
 *   Modell dafür um 180° gedreht (Rx(+90°) statt Rx(−90°)), bei 'bottom'
 *   steht es wie gedruckt. Das Kabel gibt es nur hängend.
 */
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import { neckRadiusMm } from '../geometry/surface'
import { useStudio } from '../state/store'
import { ShadeMesh } from './ShadeMesh'
import { Bulb } from './Bulb'

/** Höhe des Holz-Puck-Sockels der stehenden Variante, mm */
const FOOT_HEIGHT = 18

export function Scene() {
  const mounting = useStudio((s) => s.mounting)
  const neckPosition = useStudio((s) => s.params.neckPosition)
  const H = useStudio((s) => s.params.heightMm)
  const neck = useStudio((s) => s.params.neck)

  const standing = mounting === 'stehend'
  // kopfüber gedruckt → für die Nutzung um 180° drehen (Rx(+90°) mappt
  // Modell-z auf Welt-−y, der Kragen bei z = H landet unten auf dem Puck)
  const upsideDown = standing && neckPosition === 'top'
  const groupRotation: [number, number, number] = [upsideDown ? Math.PI / 2 : -Math.PI / 2, 0, 0]
  const groupY = standing ? (upsideDown ? H + FOOT_HEIGHT : FOOT_HEIGHT) : 0
  const footR = Math.max(neckRadiusMm(neck) + 16, 40)
  const target: [number, number, number] = [0, standing ? FOOT_HEIGHT + H * 0.45 : 80, 0]

  return (
    <Canvas
      camera={{ position: [300, 240, 320], fov: 28, near: 1, far: 3000 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#171310']} />

      <Suspense fallback={null}>
        {/* Modell-z (Höhe) → Welt-y (oben); stehend ggf. kopfüber */}
        <group rotation={groupRotation} position={[0, groupY, 0]}>
          <ShadeMesh />
          <Bulb />
        </group>

        {/* Holz-Puck der stehenden Variante */}
        {standing && (
          <mesh position={[0, FOOT_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[footR, footR * 1.05, FOOT_HEIGHT, 48]} />
            <meshStandardMaterial color="#7a5a3e" roughness={0.62} metalness={0} />
          </mesh>
        )}

        <Environment resolution={256} frames={1}>
          {/* großes Softlight von oben, zwei neutrale Flächen seitlich */}
          <Lightformer form="rect" intensity={4.5} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color="#fff1e0" />
          <Lightformer form="rect" intensity={2} position={[-9, 4, 4]} rotation-y={Math.PI / 2} scale={[7, 10, 1]} color="#e8e4dc" />
          <Lightformer form="rect" intensity={1.4} position={[9, 3, -5]} rotation-y={-Math.PI / 2} scale={[6, 9, 1]} color="#d8d2c8" />
        </Environment>

        <ContactShadows position={[0, 0.5, 0]} opacity={0.55} scale={420} blur={2.6} far={220} resolution={512} color="#000000" />

        <OrbitControls
          makeDefault
          enableDamping
          target={target}
          minDistance={140}
          maxDistance={900}
          maxPolarAngle={Math.PI * 0.55}
        />
      </Suspense>
    </Canvas>
  )
}
