/**
 * CameraRig — orbit controls plus animated camera presets.
 *
 * Presets are derived from the *current* geometry (vessel height, sheet span)
 * rather than hard-coded, so the framing stays correct when the user builds a
 * 4 m tank or a 30 × 20 sheet. Selecting a preset starts a short critically-
 * damped fly-to; touching the mouse cancels it immediately, so the camera
 * never fights the user.
 */

import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../state/simulationStore'
import { vesselHalfExtent } from '../../utils/vesselLayout'
import type { CameraPreset, SimulationModule, VesselParams } from '../../types'

type ControlsRef = ComponentRef<typeof OrbitControls>

interface Framing {
  position: THREE.Vector3
  target: THREE.Vector3
}

export function cameraFraming(
  module: SimulationModule,
  preset: CameraPreset,
  vessel: VesselParams,
  sheetSpan: number,
): Framing {
  if (module === 'calculus') {
    const s = sheetSpan
    const table: Record<CameraPreset, Framing> = {
      isometric: frame(s * 0.95, s * 0.85, s * 1.12, 0, s * 0.06, 0),
      front: frame(0, s * 0.34, s * 1.55, 0, s * 0.05, 0),
      top: frame(0.001, s * 1.65, 0.001, 0, 0, 0),
      orifice: frame(s * 0.52, s * 0.34, s * 0.62, s * 0.3, s * 0.05, s * 0.3),
      free: frame(s * 0.95, s * 0.85, s * 1.12, 0, s * 0.06, 0),
    }
    return table[preset]
  }

  const h = vessel.height
  const r = vesselHalfExtent(vessel)
  const reach = Math.max(h * 1.1, r * 4)
  const table: Record<CameraPreset, Framing> = {
    isometric: frame(reach * 0.95, h * 1.25, reach * 1.1, r * 0.9, h * 0.45, 0),
    front: frame(reach * 0.18, h * 0.62, reach * 2.1, reach * 0.42, h * 0.42, 0),
    top: frame(reach * 0.3, h * 2.6, 0.001, reach * 0.3, 0, 0),
    orifice: frame(r + reach * 0.42, h * 0.62, reach * 0.5, r + reach * 0.1, h * 0.42, 0),
    free: frame(reach * 0.95, h * 1.25, reach * 1.1, r * 0.9, h * 0.45, 0),
  }
  return table[preset]
}

function frame(px: number, py: number, pz: number, tx: number, ty: number, tz: number): Framing {
  return { position: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) }
}

export function CameraRig() {
  const controls = useRef<ControlsRef>(null)
  const camera = useThree((s) => s.camera)

  const module = useSimStore((s) => s.module)
  const preset = useSimStore((s) => s.view.preset)
  const autoRotate = useSimStore((s) => s.view.autoRotate)
  const vessel = useSimStore((s) => s.vessel)
  const calculus = useSimStore((s) => s.calculus)

  const goal = useRef<Framing | null>(null)
  const sheetSpan = 4.6

  const framing = useMemo(
    () => cameraFraming(module, preset, vessel, sheetSpan),
    [module, preset, vessel, calculus.sheetWidth, calculus.sheetLength],
  )

  // Fly to a new preset. 'free' means "leave the camera exactly where it is".
  useEffect(() => {
    if (preset === 'free') {
      goal.current = null
      return
    }
    goal.current = framing
  }, [framing, preset])

  // Any manual interaction cancels the fly-to.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const cancel = () => {
      goal.current = null
    }
    c.addEventListener('start', cancel)
    return () => c.removeEventListener('start', cancel)
  }, [])

  useFrame((_, delta) => {
    const c = controls.current
    const g = goal.current
    if (!c || !g) return

    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
    camera.position.lerp(g.position, k)
    c.target.lerp(g.target, k)
    c.update()

    if (camera.position.distanceTo(g.position) < 0.01 && c.target.distanceTo(g.target) < 0.01) {
      camera.position.copy(g.position)
      c.target.copy(g.target)
      c.update()
      goal.current = null
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.6}
      maxDistance={60}
      maxPolarAngle={Math.PI * 0.495}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      target={[0, 0.8, 0]}
    />
  )
}
