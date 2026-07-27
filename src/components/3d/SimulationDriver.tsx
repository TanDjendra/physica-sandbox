/**
 * SimulationDriver — the single owner of time.
 *
 * Lives inside the <Canvas> so it can hook `useFrame`, but renders nothing.
 * Responsibilities, in order, once per frame:
 *   1. turn wall-clock delta into simulated delta (pause / slow-mo / step),
 *   2. advance the water level with a fixed-step RK4 integrator,
 *   3. emit and integrate the Lagrangian parcels of the jet,
 *   4. publish throttled telemetry and time-series samples to React.
 *
 * No other component is allowed to advance state; they only read `runtime`
 * and push the numbers into Three.js objects.
 */

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { FluidState, IntegrationContext } from '../../types'
import {
  buildReferenceCurve,
  computeHydroTelemetry,
  exitVelocity,
  flowRate,
  integrateLevel,
  sampleReference,
} from '../../physics/fluidEngine'
import { FIXED_DT, MAX_SUBSTEPS } from '../../physics/constants'
import { readSim, useSimStore } from '../../state/simulationStore'
import { PUBLISH_INTERVAL, useTelemetryStore } from '../../state/telemetryStore'
import { runtime, resetRuntime } from '../../state/runtime'
import { orificeOrigin } from '../../utils/vesselLayout'

/** Simulated seconds between time-series samples. */
const SAMPLE_INTERVAL = 0.2

/** One press of "step" advances exactly one 60 Hz frame of simulated time. */
const STEP_DT = 1 / 60

export function SimulationDriver() {
  const resetToken = useSimStore((s) => s.resetToken)
  const environment = useSimStore((s) => s.environment)
  const module = useSimStore((s) => s.module)

  const perf = useRef({ frames: 0, accum: 0, last: 0, calls: 0, triangles: 0 })

  /** Re-integrate the theoretical reference curve from the current state. */
  const anchorReference = () => {
    const s = readSim()
    const fluid: FluidState = {
      vessel: s.vessel,
      orifice: s.orifice,
      environment: s.environment,
      waterHeight: runtime.waterHeight,
    }
    runtime.reference = buildReferenceCurve(fluid, runtime.waterHeight)
    runtime.referenceT0 = runtime.elapsed
    runtime.referenceFlow = Math.max(flowRate(fluid), 1e-9)
  }

  // Full reset: geometry, orifice or module changed, or the user pressed Reset.
  useEffect(() => {
    const s = readSim()
    resetRuntime(Math.min(s.vessel.initialFill, s.vessel.height))
    anchorReference()
    useTelemetryStore.getState().clearSeries()
    publishNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken, module])

  // Environment edits keep the run going but invalidate the old prediction.
  useEffect(() => {
    if (runtime.reference) anchorReference()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment])

  useFrame(({ gl }, delta) => {
    const s = readSim()
    const real = Math.min(delta, 0.1)

    /* ---------------- performance counters ---------------- */
    perf.current.frames += 1
    perf.current.accum += real
    perf.current.last = real

    // `gl.info.autoReset` is off (see Viewport), so these counters hold the
    // sum of every pass since the previous frame boundary. Capture, then zero.
    perf.current.calls = gl.info.render.calls
    perf.current.triangles = gl.info.render.triangles
    gl.info.reset()

    /* ---------------- simulated timestep ---------------- */
    let dt = s.clock.running ? real * s.clock.timeScale : 0
    if (s.stepPending) {
      dt = STEP_DT
      s.consumeStep()
    }

    if (s.module === 'hydrodynamics') {
      stepHydrodynamics(dt)
    }

    /* ---------------- telemetry publication ---------------- */
    runtime.publishAccumulator += real
    if (runtime.publishAccumulator >= PUBLISH_INTERVAL) {
      runtime.publishAccumulator = 0

      const store = useTelemetryStore.getState()
      const fps = perf.current.accum > 0 ? perf.current.frames / perf.current.accum : 0
      store.publishPerf({
        fps,
        frameTime: perf.current.last * 1000,
        particles: runtime.pool.count,
        drawCalls: perf.current.calls,
        triangles: perf.current.triangles,
        programs: gl.info.programs?.length ?? 0,
      })
      perf.current.frames = 0
      perf.current.accum = 0

      if (s.module === 'hydrodynamics') publishNow()
    }
  })

  return null
}

/* ------------------------------------------------------------------ *
 * Hydrodynamics step
 * ------------------------------------------------------------------ */

const fluidScratch: FluidState = {
  vessel: null as never,
  orifice: null as never,
  environment: null as never,
  waterHeight: 0,
}

const integrationScratch: IntegrationContext = {
  gravity: 9.80665,
  drag: 0.02,
  groundY: 0,
  restitution: 0.16,
  friction: 0.62,
}

function stepHydrodynamics(dt: number) {
  const s = readSim()

  fluidScratch.vessel = s.vessel
  fluidScratch.orifice = s.orifice
  fluidScratch.environment = s.environment
  fluidScratch.waterHeight = runtime.waterHeight

  /* --- 1. water level: fixed-step RK4 so results are frame-rate independent --- */
  if (dt > 0) {
    runtime.stepAccumulator += dt
    let steps = 0
    while (runtime.stepAccumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      fluidScratch.waterHeight = runtime.waterHeight
      runtime.waterHeight = integrateLevel(fluidScratch, FIXED_DT)
      runtime.stepAccumulator -= FIXED_DT
      runtime.elapsed += FIXED_DT
      steps += 1
    }
    // Long stalls (tab in background) are dropped rather than fast-forwarded.
    if (runtime.stepAccumulator > FIXED_DT * MAX_SUBSTEPS) runtime.stepAccumulator = 0
  }

  fluidScratch.waterHeight = runtime.waterHeight
  const v = exitVelocity(fluidScratch)
  const q = flowRate(fluidScratch)
  runtime.smoothedVelocity += (v - runtime.smoothedVelocity) * 0.25

  /* --- 2. parcel emission, rate proportional to the physical discharge --- */
  const pool = runtime.pool
  const cap = Math.min(s.particles.maxParticles, pool.capacity)

  if (dt > 0 && v > 0.02 && pool.count < cap) {
    const ratio = runtime.referenceFlow > 0 ? q / runtime.referenceFlow : 0
    const rate = s.particles.emissionRate * Math.min(ratio, 1.5)
    const origin = orificeOrigin(s.vessel, s.orifice)

    pool.emit(rate, dt, {
      origin,
      velocity: { x: v, y: 0, z: 0 },
      spawnRadius: s.orifice.holeRadius * 0.92,
      spread: s.particles.spread,
      speedJitter: s.particles.speedJitter,
      lifetime: s.particles.lifetime,
    })
  }

  /* --- 3. parcel integration --- */
  if (dt > 0) {
    integrationScratch.gravity = s.environment.gravity
    integrationScratch.drag = s.environment.airDrag
    pool.step(dt, integrationScratch)
  }

  // Track the landing point of the jet for the impact decal.
  const flight =
    s.environment.gravity > 1e-6 ? Math.sqrt((2 * s.orifice.holeHeight) / s.environment.gravity) : 0
  const target = orificeOrigin(s.vessel, s.orifice).x + runtime.smoothedVelocity * flight
  runtime.impactX += (target - runtime.impactX) * 0.12

  /* --- 4. time-series recorder --- */
  if (dt > 0) {
    runtime.sampleAccumulator += dt
    if (runtime.sampleAccumulator >= SAMPLE_INTERVAL) {
      runtime.sampleAccumulator = 0
      const theory = runtime.reference
        ? sampleReference(runtime.reference, runtime.elapsed - runtime.referenceT0)
        : runtime.waterHeight
      useTelemetryStore.getState().pushSample({
        t: runtime.elapsed,
        sim: runtime.waterHeight,
        theory,
        flow: q,
        velocity: v,
      })
    }
  }
}

/** Push a fresh hydro telemetry record to React immediately. */
function publishNow() {
  const s = readSim()
  const state: FluidState = {
    vessel: s.vessel,
    orifice: s.orifice,
    environment: s.environment,
    waterHeight: runtime.waterHeight,
  }
  const telemetry = computeHydroTelemetry(state, runtime.initialFill)
  useTelemetryStore
    .getState()
    .publish(telemetry, runtime.elapsed, telemetry.head <= 1e-4 && !s.environment.refill)
}
