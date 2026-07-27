/**
 * VectorArrows — the physics overlay layer.
 *
 *  • PressureField   hydrostatic pressure P = ρg(h − y) sampled up the wall,
 *                    drawn as outward arrows whose length is proportional to P.
 *  • VelocityArrow   the efflux vector at the orifice, v = C_d√(2gH).
 *  • HeadIndicator   the measured head H between free surface and orifice.
 *  • TrajectoryGuide the analytic drag-free parabola and its landing point,
 *                    so the user can see how far the drag model deviates.
 *
 * Every arrow is a static mesh whose transform is written each frame; nothing
 * here allocates or re-renders React.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { runtime } from '../../state/runtime'
import { wallDistanceAt } from '../../utils/vesselLayout'
import { fixed, pressure } from '../../utils/format'

const PRESSURE_STATIONS = 8
const TRAJECTORY_SAMPLES = 64
const HEAD_ARROW = 0.55

/* ------------------------------------------------------------------ *
 * A reusable shaft + cone arrow pointing along local +Y.
 * ------------------------------------------------------------------ */

interface ArrowHandle {
  group: THREE.Group | null
  shaft: THREE.Mesh | null
  head: THREE.Mesh | null
}

function setArrowLength(handle: ArrowHandle, length: number, headSize: number) {
  const { shaft, head } = handle
  const body = Math.max(length - headSize, 1e-4)
  if (shaft) {
    shaft.scale.y = body
    shaft.position.y = body / 2
  }
  if (head) {
    head.position.y = body + headSize / 2
    head.scale.setScalar(1)
  }
}

/* ------------------------------------------------------------------ *
 * Pressure distribution
 * ------------------------------------------------------------------ */

export function PressureField() {
  const vessel = useSimStore((s) => s.vessel)
  const density = useSimStore((s) => s.environment.fluidDensity)
  const gravity = useSimStore((s) => s.environment.gravity)

  const handles = useRef<ArrowHandle[]>(
    Array.from({ length: PRESSURE_STATIONS }, () => ({ group: null, shaft: null, head: null })),
  )

  useFrame(() => {
    const h = runtime.waterHeight
    const pMax = Math.max(density * gravity * h, 1e-6)

    for (let i = 0; i < PRESSURE_STATIONS; i++) {
      const handle = handles.current[i]
      if (!handle.group) continue

      // Stations sit inside the current liquid column, evenly spaced.
      const frac = (i + 0.5) / PRESSURE_STATIONS
      const y = h * frac
      const depth = h - y
      const p = density * gravity * depth

      const visible = h > 0.05 && gravity > 1e-6
      handle.group.visible = visible
      if (!visible) continue

      handle.group.position.set(wallDistanceAt(vessel, y), y, 0)
      const length = 0.04 + (p / pMax) * 0.42
      setArrowLength(handle, length, 0.06)
    }
  })

  return (
    <group>
      {handles.current.map((_, i) => (
        <group
          key={i}
          rotation-z={-Math.PI / 2}
          ref={(el) => {
            handles.current[i].group = el
          }}
        >
          <mesh
            ref={(el) => {
              handles.current[i].shaft = el
            }}
          >
            <cylinderGeometry args={[0.008, 0.008, 1, 8]} />
            <meshStandardMaterial
              color="#a78bfa"
              emissive="#7c3aed"
              emissiveIntensity={0.55}
              roughness={0.4}
              toneMapped={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              handles.current[i].head = el
            }}
          >
            <coneGeometry args={[0.026, 0.06, 12]} />
            <meshStandardMaterial
              color="#c4b5fd"
              emissive="#8b5cf6"
              emissiveIntensity={0.7}
              roughness={0.35}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Efflux velocity vector
 * ------------------------------------------------------------------ */

export function VelocityArrow() {
  const vessel = useSimStore((s) => s.vessel)
  const orifice = useSimStore((s) => s.orifice)
  const showLabels = useSimStore((s) => s.view.showLabels)
  const telemetry = useTelemetryStore((s) => s.hydro)

  const handle = useRef<ArrowHandle>({ group: null, shaft: null, head: null })

  useFrame(() => {
    const g = handle.current.group
    if (!g) return
    const v = runtime.smoothedVelocity
    const visible = v > 0.03
    g.visible = visible
    if (!visible) return
    g.position.set(wallDistanceAt(vessel, orifice.holeHeight), orifice.holeHeight, 0)
    // 1 m of arrow per 4 m·s⁻¹, capped so extreme gravity stays on screen.
    setArrowLength(handle.current, Math.min(0.12 + v * 0.16, 1.6), 0.11)
  })

  return (
    <group
      rotation-z={-Math.PI / 2}
      ref={(el) => {
        handle.current.group = el
      }}
    >
      <mesh
        ref={(el) => {
          handle.current.shaft = el
        }}
      >
        <cylinderGeometry args={[0.015, 0.015, 1, 12]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={0.9}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={(el) => {
          handle.current.head = el
        }}
      >
        <coneGeometry args={[0.045, 0.11, 16]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#38bdf8"
          emissiveIntensity={1.1}
          roughness={0.25}
          toneMapped={false}
        />
      </mesh>
      {showLabels && (
        <Html
          position={[0.1, 0.9, 0]}
          center
          distanceFactor={6}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-sky-400/30 bg-slate-950/80 px-2 py-1 font-mono text-[11px] text-sky-200 shadow-lg backdrop-blur">
            v = {fixed(telemetry.exitVelocity, 2)} m/s
          </div>
        </Html>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Head measurement
 * ------------------------------------------------------------------ */

export function HeadIndicator() {
  const vessel = useSimStore((s) => s.vessel)
  const orifice = useSimStore((s) => s.orifice)
  const showLabels = useSimStore((s) => s.view.showLabels)
  const telemetry = useTelemetryStore((s) => s.hydro)
  const labelRef = useRef<THREE.Group>(null)

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3))
    const material = new THREE.LineBasicMaterial({
      color: '#f472b6',
      transparent: true,
      opacity: 0.9,
    })
    return new THREE.Line(geometry, material)
  }, [])

  useFrame(() => {
    const h = runtime.waterHeight
    const y = orifice.holeHeight
    const x = wallDistanceAt(vessel, Math.max(h, y)) + HEAD_ARROW * 0.35
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const cap = 0.07

    const write = (i: number, px: number, py: number, pz: number) => {
      arr[i * 3] = px
      arr[i * 3 + 1] = py
      arr[i * 3 + 2] = pz
    }

    write(0, x - cap, h, 0)
    write(1, x + cap, h, 0)
    write(2, x, h, 0)
    write(3, x, y, 0)
    write(4, x - cap, y, 0)
    write(5, x + cap, y, 0)
    attr.needsUpdate = true

    line.visible = h - y > 0.03
    if (labelRef.current) {
      labelRef.current.visible = line.visible
      labelRef.current.position.set(x, (h + y) / 2, 0)
    }
  })

  return (
    <group>
      <primitive object={line} />
      {showLabels && (
        <group ref={labelRef}>
          <Html center distanceFactor={6} style={{ pointerEvents: 'none' }}>
            <div className="whitespace-nowrap rounded-md border border-pink-400/30 bg-slate-950/80 px-2 py-1 font-mono text-[11px] text-pink-200 shadow-lg backdrop-blur">
              H = {fixed(telemetry.head, 3)} m · {pressure(telemetry.pressureAtOrifice)}
            </div>
          </Html>
        </group>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Analytic trajectory guide
 * ------------------------------------------------------------------ */

export function TrajectoryGuide() {
  const vessel = useSimStore((s) => s.vessel)
  const orifice = useSimStore((s) => s.orifice)
  const gravity = useSimStore((s) => s.environment.gravity)
  const ringRef = useRef<THREE.Mesh>(null)

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((TRAJECTORY_SAMPLES + 1) * 3), 3),
    )
    const material = new THREE.LineDashedMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.75,
      dashSize: 0.06,
      gapSize: 0.045,
    })
    return new THREE.Line(geometry, material)
  }, [])

  useFrame(() => {
    const v = runtime.smoothedVelocity
    const y0 = orifice.holeHeight
    const x0 = wallDistanceAt(vessel, y0)
    const visible = v > 0.05 && gravity > 1e-6
    line.visible = visible
    if (ringRef.current) ringRef.current.visible = visible
    if (!visible) return

    const tf = Math.sqrt((2 * y0) / gravity)
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i <= TRAJECTORY_SAMPLES; i++) {
      const t = (i / TRAJECTORY_SAMPLES) * tf
      arr[i * 3] = x0 + v * t
      arr[i * 3 + 1] = y0 - 0.5 * gravity * t * t
      arr[i * 3 + 2] = 0
    }
    attr.needsUpdate = true
    line.geometry.computeBoundingSphere()
    line.computeLineDistances()

    if (ringRef.current) ringRef.current.position.x = x0 + v * tf
  })

  return (
    <group>
      <primitive object={line} />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.05, 0.075, 40]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Composed overlay
 * ------------------------------------------------------------------ */

export function PhysicsOverlays() {
  const view = useSimStore((s) => s.view)
  return (
    <group>
      {view.showPressureField && <PressureField />}
      {view.showVelocityVector && <VelocityArrow />}
      {view.showVelocityVector && <HeadIndicator />}
      {view.showTrajectory && <TrajectoryGuide />}
    </group>
  )
}
