/**
 * ParticleJet — GPU-instanced rendering of the efflux parcels.
 *
 * One `InstancedMesh` draws every parcel in a single draw call. The pool keeps
 * live parcels densely packed, so `mesh.count = pool.count` skips dead slots
 * without any per-frame compaction here.
 *
 * Per instance we write:
 *   • position from the pool,
 *   • a quaternion aligning +Y with the velocity and a Y stretch proportional
 *     to speed, which reads as motion blur without any post-processing,
 *   • a colour ramp from the fluid tint (slow) to near-white (fast),
 *   • a scale that collapses to zero over the final 25 % of the lifetime so
 *     parcels dissolve instead of popping.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimStore } from '../../state/simulationStore'
import { runtime } from '../../state/runtime'
import { MAX_PARTICLES } from '../../physics/constants'
import { fluidColorForDensity } from './WaterVessel'

const UP = new THREE.Vector3(0, 1, 0)
/** Seconds of motion converted into instance elongation. */
const STRETCH = 0.05
/** Speed (m·s⁻¹) at which the colour ramp reaches its bright end. */
const SPEED_REFERENCE = 6

export function ParticleJet() {
  const particleRadius = useSimStore((s) => s.particles.particleRadius)
  const density = useSimStore((s) => s.environment.fluidDensity)
  const showTrajectory = useSimStore((s) => s.view.showTrajectory)

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const impactRef = useRef<THREE.Mesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const tint = useMemo(() => new THREE.Color(), [])

  const slowColor = useMemo(() => new THREE.Color(fluidColorForDensity(density)), [density])
  const fastColor = useMemo(() => new THREE.Color('#f0f9ff'), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const pool = runtime.pool
    const n = Math.min(pool.count, MAX_PARTICLES)
    const { position, velocity, life, maxLife, seed } = pool

    for (let i = 0; i < n; i++) {
      const p = i * 3
      const vx = velocity[p]
      const vy = velocity[p + 1]
      const vz = velocity[p + 2]
      const speed = Math.hypot(vx, vy, vz)

      dummy.position.set(position[p], position[p + 1], position[p + 2])

      if (speed > 1e-4) {
        dir.set(vx / speed, vy / speed, vz / speed)
        quat.setFromUnitVectors(UP, dir)
        dummy.quaternion.copy(quat)
      } else {
        dummy.quaternion.identity()
      }

      // Size: per-parcel jitter, fade-out tail, and speed elongation.
      const remaining = maxLife[i] > 0 ? life[i] / maxLife[i] : 0
      const fade = remaining > 0.25 ? 1 : Math.max(remaining, 0) / 0.25
      const r = particleRadius * (0.72 + seed[i] * 0.56) * fade
      dummy.scale.set(r, r * (1 + speed * STRETCH), r)

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      tint.copy(slowColor).lerp(fastColor, Math.min(speed / SPEED_REFERENCE, 1))
      mesh.setColorAt(i, tint)
    }

    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Impact glow follows the computed landing point of the jet.
    const impact = impactRef.current
    if (impact) {
      const active = runtime.smoothedVelocity > 0.05
      impact.visible = active && showTrajectory
      if (active) {
        impact.position.x = runtime.impactX
        const s = 0.18 + Math.min(runtime.smoothedVelocity * 0.06, 0.4)
        impact.scale.setScalar(s)
        const mat = impact.material as THREE.MeshBasicMaterial
        mat.opacity = Math.min(0.05 + runtime.smoothedVelocity * 0.06, 0.4)
      }
    }
  })

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      >
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial
          roughness={0.12}
          metalness={0.05}
          envMapIntensity={1.6}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Wet patch where the jet meets the floor. */}
      <mesh ref={impactRef} rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} renderOrder={1}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
