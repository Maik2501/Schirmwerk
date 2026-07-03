/**
 * Studio-Szene: dunkle Bühne, weiche Lichtflächen, Kontaktschatten.
 *
 * - Die Lichtumgebung ist aus Lightformern selbst gebaut (kein HDRI-Download,
 *   die App bleibt komplett offline-fähig und deterministisch).
 * - Modellkoordinaten haben z als Höhe (Slicer-Konvention); three.js rendert
 *   y-oben. Die Gruppe rotiert deshalb um −90° um x: Modell-z → Welt-y.
 */
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import { ShadeMesh } from './ShadeMesh'
import { Bulb } from './Bulb'

export function Scene() {
  return (
    <Canvas
      camera={{ position: [300, 240, 320], fov: 28, near: 1, far: 3000 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#171310']} />

      <Suspense fallback={null}>
        {/* Modell-z (Höhe) → Welt-y (oben) */}
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <ShadeMesh />
          <Bulb />
        </group>

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
          target={[0, 80, 0]}
          minDistance={140}
          maxDistance={900}
          maxPolarAngle={Math.PI * 0.55}
        />
      </Suspense>
    </Canvas>
  )
}
