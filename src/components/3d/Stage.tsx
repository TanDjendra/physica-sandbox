/**
 * Stage — lighting, ground plane and reference grid.
 *
 * The environment map is generated in-scene from `Lightformer` panels and
 * baked once (`frames={1}`), so the glass and liquid get believable
 * reflections with zero network requests and zero per-frame cost.
 */

import { ContactShadows, Environment, Grid, Lightformer } from '@react-three/drei'
import { useSimStore } from '../../state/simulationStore'

export function Stage() {
  const showGrid = useSimStore((s) => s.view.showGrid)
  const shadows = useSimStore((s) => s.view.shadows)
  const module = useSimStore((s) => s.module)

  const spread = module === 'calculus' ? 14 : 9

  return (
    <>
      <fog attach="fog" args={['#060a14', spread * 1.2, spread * 4]} />

      <hemisphereLight args={['#7dd3fc', '#0b1220', 0.55]} />
      <ambientLight intensity={0.18} />

      <directionalLight
        position={[4.5, 7.5, 4]}
        intensity={2.1}
        color="#eaf4ff"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-spread, spread, spread, -spread, 0.1, 40]}
        />
      </directionalLight>

      {/* rim + fill, purely for shape definition */}
      <directionalLight position={[-6, 3.5, -4]} intensity={0.55} color="#8b5cf6" />
      <pointLight position={[2.4, 1.2, 2.4]} intensity={6} distance={9} color="#38bdf8" />

      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.4} position={[0, 6, 0]} scale={[9, 9, 1]} rotation-x={Math.PI / 2} color="#dbeafe" />
        <Lightformer intensity={1.4} position={[-6, 2, 2]} scale={[6, 6, 1]} rotation-y={Math.PI / 2} color="#38bdf8" />
        <Lightformer intensity={1.1} position={[6, 2, -2]} scale={[6, 6, 1]} rotation-y={-Math.PI / 2} color="#a78bfa" />
        <Lightformer intensity={0.7} position={[0, 1, -8]} scale={[10, 4, 1]} color="#1e293b" />
      </Environment>

      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <circleGeometry args={[spread * 2.2, 72]} />
        <meshStandardMaterial color="#0b1220" roughness={0.88} metalness={0.12} />
      </mesh>

      {showGrid && (
        <Grid
          position={[0, 0.002, 0]}
          args={[spread * 3, spread * 3]}
          cellSize={0.25}
          cellThickness={0.6}
          cellColor="#1e3a5f"
          sectionSize={1}
          sectionThickness={1.1}
          sectionColor="#2b6ca3"
          fadeDistance={spread * 3.2}
          fadeStrength={1.4}
          followCamera={false}
          infiniteGrid
        />
      )}

      {shadows && (
        <ContactShadows
          position={[0, 0.004, 0]}
          scale={spread * 2}
          resolution={1024}
          blur={2.2}
          opacity={0.55}
          far={spread}
          color="#020617"
        />
      )}
    </>
  )
}
