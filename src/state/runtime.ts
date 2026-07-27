/**
 * runtime — mutable per-frame simulation state that must never touch React.
 *
 * Everything in here is written from inside `useFrame`. Components read it
 * directly and mutate Three.js objects; nothing subscribes to it, so no
 * re-render is ever triggered by the integrator.
 */

import { ParticlePool } from '../physics/particlePool'
import { MAX_PARTICLES } from '../physics/constants'
import type { ReferenceCurve } from '../physics/fluidEngine'

export interface SimRuntime {
  /** Live water column height above the vessel floor (m). */
  waterHeight: number
  /** Simulated seconds since the last reset. */
  elapsed: number
  /** Water height at t = 0 for the current run (m). */
  initialFill: number
  /** Volumetric flow rate at t = 0 — the reference for parcel emission. */
  referenceFlow: number
  /** Pre-integrated "theory" curve for the analytics overlay. */
  reference: ReferenceCurve | null
  /**
   * Simulated time at which `reference` was anchored. Changing gravity or the
   * fluid mid-run re-anchors the theory curve here instead of pretending the
   * original prediction still applies.
   */
  referenceT0: number
  /** Shared Lagrangian parcel buffer. */
  pool: ParticlePool
  /** Ping-pong phase for the auto-fold animation (0–1). */
  foldPhase: number
  /** Where the jet is currently landing on the floor plane (m from the wall). */
  impactX: number
  /** Smoothed jet speed, used for damping visual jitter (m·s⁻¹). */
  smoothedVelocity: number
  /** Seconds accumulated since the last telemetry publish. */
  publishAccumulator: number
  /** Seconds accumulated since the last time-series sample. */
  sampleAccumulator: number
  /** Leftover simulated time for the fixed-step integrator. */
  stepAccumulator: number
}

export const runtime: SimRuntime = {
  waterHeight: 0,
  elapsed: 0,
  initialFill: 0,
  referenceFlow: 0,
  reference: null,
  referenceT0: 0,
  pool: new ParticlePool(MAX_PARTICLES),
  foldPhase: 0,
  impactX: 0,
  smoothedVelocity: 0,
  publishAccumulator: 0,
  sampleAccumulator: 0,
  stepAccumulator: 0,
}

/** Re-seed the runtime for a fresh run. */
export function resetRuntime(initialFill: number): void {
  runtime.waterHeight = initialFill
  runtime.initialFill = initialFill
  runtime.elapsed = 0
  runtime.referenceFlow = 0
  runtime.reference = null
  runtime.referenceT0 = 0
  runtime.foldPhase = 0
  runtime.impactX = 0
  runtime.smoothedVelocity = 0
  runtime.publishAccumulator = 0
  runtime.sampleAccumulator = 0
  runtime.stepAccumulator = 0
  runtime.pool.reset()
}
