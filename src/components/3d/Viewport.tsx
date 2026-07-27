/**
 * Viewport — the WebGL surface.
 *
 * Owns the <Canvas>, mounts the module-specific scene graph and the single
 * SimulationDriver that advances time. Local clipping is enabled here so the
 * cross-section toggle in `WaterVessel` has something to clip against.
 */

import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { runtime } from '../../state/runtime'
import { Stage } from './Stage'
import { CameraRig } from './CameraRig'
import { SimulationDriver } from './SimulationDriver'
import { WaterVessel } from './WaterVessel'
import { ParticleJet } from './ParticleJet'
import { PhysicsOverlays } from './VectorArrows'
import { FoldingBox } from './FoldingBox'

function SceneContent() {
  const module = useSimStore((s) => s.module)

  return (
    <>
      <Stage />
      {module === 'hydrodynamics' ? (
        <>
          <WaterVessel />
          <ParticleJet />
          <PhysicsOverlays />
        </>
      ) : (
        <FoldingBox />
      )}
    </>
  )
}

/**
 * Dev-only bridge. Exposes the R3F store, the mutable runtime and both zustand
 * stores on `window.__physica` so the simulation can be driven and inspected
 * from the console (or an automated check) without a visible frame loop.
 * Stripped from production builds by the `import.meta.env.DEV` guard.
 */
function DebugBridge() {
  const store = useThree((s) => s)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    Object.assign(window, {
      __physica: {
        three: store,
        runtime,
        sim: useSimStore,
        telemetry: useTelemetryStore,
      },
    })
  }, [store])

  return null
}

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-lg border border-sky-400/20 bg-slate-950/80 px-4 py-2 text-xs text-sky-200">
        <span className="live-dot h-2 w-2 rounded-full bg-sky-400" />
        compiling shaders…
      </div>
    </Html>
  )
}

export function Viewport() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [3.2, 2.6, 3.8], fov: 42, near: 0.05, far: 200 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true,
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        // A frame contains several passes (shadow map, contact shadows, the
        // main scene, the gizmo's own scene). With autoReset on, each pass
        // clobbers the counters and the diagnostics panel would report only
        // the last one. The driver resets them once per frame instead.
        gl.info.autoReset = false
      }}
    >
      <Suspense fallback={<Loader />}>
        <SceneContent />
      </Suspense>

      <SimulationDriver />
      <CameraRig />
      <DebugBridge />

      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport
          axisColors={['#f87171', '#4ade80', '#38bdf8']}
          labelColor="#0f172a"
          hideNegativeAxes
        />
      </GizmoHelper>
    </Canvas>
  )
}
