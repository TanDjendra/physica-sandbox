/**
 * WaterVessel — the glass container, its liquid body and the orifice.
 *
 * Performance contract: the liquid mesh is *not* rebuilt every frame. Its
 * geometry is regenerated only when the level crosses a quantisation step
 * (~1/192 of the vessel height) and the residual is absorbed by a Y scale, so
 * a full drain costs ~192 geometry builds instead of ~3 000 while still moving
 * pixel-smoothly. For a conical frustum this keeps the taper correct to within
 * one quantum of radius, which is far below a pixel at normal zoom.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimStore } from '../../state/simulationStore'
import { runtime } from '../../state/runtime'
import { FLUIDS } from '../../physics/constants'
import { radiusAtHeight } from '../../physics/fluidEngine'
import { buildVesselGeometry, quantiseHeight, wallDistanceAt } from '../../utils/vesselLayout'
import type { VesselParams } from '../../types'

const WALL_THICKNESS = 0.022
const HEIGHT_STEPS = 192

/** Nearest preset colour for the current density — purely cosmetic. */
export function fluidColorForDensity(density: number): string {
  let best: { density: number; color: string } = FLUIDS.water
  let bestDelta = Infinity
  for (const f of Object.values(FLUIDS)) {
    const d = Math.abs(f.density - density)
    if (d < bestDelta) {
      bestDelta = d
      best = f
    }
  }
  return best.color
}

export function WaterVessel() {
  const vessel = useSimStore((s) => s.vessel)
  const orifice = useSimStore((s) => s.orifice)
  const crossSection = useSimStore((s) => s.view.crossSection)
  const density = useSimStore((s) => s.environment.fluidDensity)

  const liquidRef = useRef<THREE.Mesh>(null)
  const surfaceRef = useRef<THREE.Mesh>(null)
  const lastQuant = useRef(-1)

  const clipPlanes = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)], [])
  const activeClip = crossSection ? clipPlanes : []

  const liquidColor = useMemo(() => fluidColorForDensity(density), [density])

  /* ---------------- static geometry ---------------- */

  const shell = useMemo(() => buildShell(vessel), [vessel])
  useEffect(() => () => shell.dispose(), [shell])

  const floorGeometry = useMemo(() => {
    if (vessel.shape === 'box') {
      return new THREE.BoxGeometry(vessel.width, WALL_THICKNESS, vessel.depth)
    }
    const r = vessel.shape === 'cone' ? vessel.radius * vessel.taper : vessel.radius
    return new THREE.CylinderGeometry(r, r, WALL_THICKNESS, 56)
  }, [vessel])
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry])

  /* ---------------- liquid, rebuilt on quantised level change ---------------- */

  const syncLiquid = (height: number) => {
    const mesh = liquidRef.current
    if (!mesh) return

    const q = Math.max(quantiseHeight(height, vessel.height, HEIGHT_STEPS), vessel.height / HEIGHT_STEPS)
    if (q !== lastQuant.current) {
      lastQuant.current = q
      const next = buildVesselGeometry(vessel, q)
      mesh.geometry.dispose()
      mesh.geometry = next
    }

    const visible = height > 1e-4
    mesh.visible = visible
    if (!visible) return

    mesh.scale.y = height / q
    mesh.position.y = height / 2

    const surface = surfaceRef.current
    if (surface) {
      const r = radiusAtHeight(vessel, height)
      surface.visible = vessel.shape !== 'box'
      surface.position.y = height
      surface.scale.setScalar(Math.max(r, 1e-3))
    }
  }

  // Seed on mount / whenever the vessel definition changes.
  useLayoutEffect(() => {
    lastQuant.current = -1
    syncLiquid(runtime.waterHeight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel])

  useFrame(() => syncLiquid(runtime.waterHeight))

  /* ---------------- orifice ---------------- */

  const wallX = wallDistanceAt(vessel, orifice.holeHeight)

  return (
    <group>
      {/* --- transparent shell --- */}
      {vessel.shape === 'box' ? (
        <BoxShell vessel={vessel} clippingPlanes={activeClip} />
      ) : (
        <mesh geometry={shell} position-y={vessel.height / 2}>
          <meshPhysicalMaterial
            color="#cfe6ff"
            transmission={0.94}
            thickness={0.22}
            roughness={0.06}
            metalness={0}
            ior={1.5}
            clearcoat={1}
            clearcoatRoughness={0.08}
            transparent
            opacity={1}
            side={THREE.DoubleSide}
            clippingPlanes={activeClip}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* --- vessel floor --- */}
      <mesh geometry={floorGeometry} position-y={WALL_THICKNESS / 2} receiveShadow>
        <meshPhysicalMaterial
          color="#a8c8e8"
          roughness={0.18}
          metalness={0.1}
          transmission={0.55}
          thickness={0.1}
          transparent
          ior={1.5}
          side={THREE.DoubleSide}
          clippingPlanes={activeClip}
        />
      </mesh>

      {/* --- liquid body --- */}
      <mesh ref={liquidRef} castShadow renderOrder={2}>
        <meshPhysicalMaterial
          color={liquidColor}
          transmission={0.72}
          thickness={0.55}
          roughness={0.08}
          ior={1.333}
          metalness={0}
          attenuationColor={liquidColor}
          attenuationDistance={1.4}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          clippingPlanes={activeClip}
        />
      </mesh>

      {/* --- bright meniscus ring at the free surface --- */}
      <mesh ref={surfaceRef} rotation-x={-Math.PI / 2} renderOrder={3}>
        <torusGeometry args={[1, 0.012, 8, 72]} />
        <meshBasicMaterial
          color={liquidColor}
          transparent
          opacity={0.85}
          toneMapped={false}
          clippingPlanes={activeClip}
        />
      </mesh>

      {/* --- orifice: dark mouth + emissive rim --- */}
      <group position={[wallX, orifice.holeHeight, 0]} rotation-z={-Math.PI / 2}>
        <mesh>
          <cylinderGeometry args={[orifice.holeRadius, orifice.holeRadius, 0.05, 32]} />
          <meshStandardMaterial color="#04070f" roughness={1} metalness={0} />
        </mesh>
        <mesh position-y={0.026}>
          <torusGeometry args={[orifice.holeRadius, 0.008, 10, 40]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={1.4}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Shell construction
 * ------------------------------------------------------------------ */

/** Open-topped wall geometry for round vessels. */
function buildShell(vessel: VesselParams): THREE.BufferGeometry {
  if (vessel.shape === 'box') return new THREE.BufferGeometry()
  const rTop = vessel.radius
  const rBottom = vessel.shape === 'cone' ? vessel.radius * vessel.taper : vessel.radius
  return new THREE.CylinderGeometry(rTop, rBottom, vessel.height, 56, 1, true)
}

/** Four independent glass panes — a BoxGeometry would look like a solid block. */
function BoxShell({
  vessel,
  clippingPlanes,
}: {
  vessel: VesselParams
  clippingPlanes: THREE.Plane[]
}) {
  const { width, depth, height } = vessel
  const t = WALL_THICKNESS
  const panes: Array<[[number, number, number], [number, number, number]]> = [
    [
      [width / 2, height / 2, 0],
      [t, height, depth],
    ],
    [
      [-width / 2, height / 2, 0],
      [t, height, depth],
    ],
    [
      [0, height / 2, depth / 2],
      [width, height, t],
    ],
    [
      [0, height / 2, -depth / 2],
      [width, height, t],
    ],
  ]

  return (
    <group>
      {panes.map(([position, size], i) => (
        <mesh key={i} position={position}>
          <boxGeometry args={size} />
          <meshPhysicalMaterial
            color="#cfe6ff"
            transmission={0.94}
            thickness={0.18}
            roughness={0.06}
            ior={1.5}
            clearcoat={1}
            transparent
            depthWrite={false}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ))}
    </group>
  )
}
