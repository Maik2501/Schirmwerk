/**
 * Glühbirnen-Simulation: warme Lichtquelle (≈2700 K) im Inneren des Schirms,
 * dazu emissive Birnenkugel, Fassungskappe und Kabel für den Pendel-Look.
 *
 * Micro-Interaction aus dem Designplan: Beim Laden „glüht“ die Birne sanft
 * an (Intensität wird per Frame gelerpt). Bei prefers-reduced-motion
 * springt sie ohne Animation direkt auf den Zielwert.
 *
 * Achtung Einheiten: Die Szene ist in Millimetern. three.js rechnet
 * Punktlicht-Abfall physikalisch (decay 2 → 1/d²), d.h. die Intensität
 * muss bei mm-Distanzen entsprechend groß gewählt werden.
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStudio } from '../state/store'

const WARM_LIGHT = '#ffb46b' // ≈ 2700 K
const LIGHT_INTENSITY = 320_000
/** zweites, weicher abfallendes Licht (decay 1) – füllt den Schirm bis zum Rand */
const FILL_INTENSITY = 3_600
const GLOW_INTENSITY = 4.2

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Bulb() {
  const bulbOn = useStudio((s) => s.bulbOn)
  const params = useStudio((s) => s.params)

  const lightRef = useRef<THREE.PointLight>(null)
  const fillRef = useRef<THREE.PointLight>(null)
  const glowRef = useRef<THREE.MeshStandardMaterial>(null)
  // Anlauf bei 0 → warmes Aufglühen beim Laden
  const level = useRef(0)

  useFrame((_, dt) => {
    const target = bulbOn ? 1 : 0
    const speed = prefersReducedMotion ? Infinity : 2.6
    const k = speed === Infinity ? 1 : 1 - Math.exp(-dt * speed)
    level.current += (target - level.current) * k
    if (lightRef.current) lightRef.current.intensity = LIGHT_INTENSITY * level.current
    if (fillRef.current) fillRef.current.intensity = FILL_INTENSITY * level.current
    if (glowRef.current) glowRef.current.emissiveIntensity = GLOW_INTENSITY * level.current
  })

  const H = params.heightMm
  // Birne (A60, Ø 60) hängt unterhalb des Halses; Koordinaten in Modell-Z (Höhe)
  const bulbZ = H - params.neck.heightMm - 52
  const capBottom = bulbZ + 26
  const capTop = H + 2
  const cordTop = H + 220

  return (
    <group>
      <pointLight ref={lightRef} position={[0, 0, bulbZ]} color={WARM_LIGHT} decay={2} intensity={0} />
      <pointLight ref={fillRef} position={[0, 0, bulbZ - 50]} color={WARM_LIGHT} decay={1} intensity={0} />

      {/* Birnenkugel */}
      <mesh position={[0, 0, bulbZ]}>
        <sphereGeometry args={[30, 48, 32]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#413528"
          emissive="#ffc98a"
          emissiveIntensity={0}
          roughness={0.4}
        />
      </mesh>

      {/* Fassungskappe (Zylinderachse ist lokal y → um x auf die z-Höhenachse drehen) */}
      <mesh position={[0, 0, (capBottom + capTop) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[13, 14, capTop - capBottom, 32]} />
        <meshStandardMaterial color="#15120f" roughness={0.55} metalness={0.15} />
      </mesh>

      {/* Kabel nach oben aus dem Bild */}
      <mesh position={[0, 0, (capTop + cordTop) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.8, 1.8, cordTop - capTop, 12]} />
        <meshStandardMaterial color="#0d0b09" roughness={0.7} />
      </mesh>
    </group>
  )
}
