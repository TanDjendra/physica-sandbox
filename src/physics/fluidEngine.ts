/**
 * fluidEngine — pure hydrodynamics.
 *
 * No React, no Three.js, no module-level mutable state: every function here is
 * a deterministic map from its arguments to a number (or a plain array), which
 * makes the whole model unit-testable and safe to call from a render loop.
 *
 * ── Model ────────────────────────────────────────────────────────────────────
 * Torricelli's law follows from Bernoulli applied between the free surface (1)
 * and the orifice (2) of an open vessel, assuming quasi-steady flow and
 * A_vessel ≫ A_orifice:
 *
 *     P₀ + ρ g h + ½ρv₁²  =  P₀ + ρ g y + ½ρv₂²      with v₁ ≈ 0
 *  ⇒  v_ideal = √(2 g (h − y))
 *
 * Real orifices lose energy and the jet contracts (vena contracta). Both are
 * folded into the single discharge coefficient C_d, so this engine uses
 *
 *     v_jet = C_d √(2 g H)        Q = a · v_jet = C_d · a · √(2 g H)
 *
 * which reproduces the textbook discharge equation exactly while keeping one
 * user-facing knob. H = h − y is the head above the orifice.
 *
 * Draining is the mass-balance ODE
 *
 *     A(h) · dh/dt = −C_d · a · √(2 g (h − y))
 *
 * integrated with classic RK4. A(h) is constant for cylinders and prisms
 * (closed-form solution available) and quadratic in h for a conical frustum
 * (solved numerically).
 */

import type {
  CurvePoint,
  FluidState,
  HydroTelemetry,
  OrificeParams,
  VesselParams,
} from '../types'
import { EPS } from './constants'

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/** Inner radius of the vessel at height `y` above the floor (m). */
export function radiusAtHeight(vessel: VesselParams, y: number): number {
  if (vessel.shape !== 'cone') return vessel.radius
  const rBottom = vessel.radius * vessel.taper
  const t = clamp(y / Math.max(vessel.height, EPS), 0, 1)
  return rBottom + (vessel.radius - rBottom) * t
}

/** Horizontal cross-sectional area A(y) of the liquid column (m²). */
export function crossSectionArea(vessel: VesselParams, y: number): number {
  switch (vessel.shape) {
    case 'box':
      return vessel.width * vessel.depth
    case 'cylinder':
      return Math.PI * vessel.radius * vessel.radius
    case 'cone': {
      const r = radiusAtHeight(vessel, y)
      return Math.PI * r * r
    }
  }
}

/** Liquid volume contained between the floor and height `h` (m³). */
export function liquidVolume(vessel: VesselParams, h: number): number {
  const height = clamp(h, 0, vessel.height)
  switch (vessel.shape) {
    case 'box':
      return vessel.width * vessel.depth * height
    case 'cylinder':
      return Math.PI * vessel.radius * vessel.radius * height
    case 'cone': {
      // ∫₀ʰ π (a + b y)² dy  with a = r_bottom, b = (r_top − r_bottom)/H
      const a = vessel.radius * vessel.taper
      const b = (vessel.radius - a) / Math.max(vessel.height, EPS)
      return Math.PI * (a * a * height + a * b * height * height + (b * b * height ** 3) / 3)
    }
  }
}

/** Total capacity of the vessel (m³). */
export function vesselCapacity(vessel: VesselParams): number {
  return liquidVolume(vessel, vessel.height)
}

/** Area of the circular orifice (m²). */
export function orificeArea(orifice: OrificeParams): number {
  return Math.PI * orifice.holeRadius * orifice.holeRadius
}

/* ------------------------------------------------------------------ *
 * Core hydrodynamics
 * ------------------------------------------------------------------ */

/** Head above the orifice, H = h − y, clamped at zero (m). */
export function effectiveHead(waterHeight: number, holeHeight: number): number {
  return Math.max(0, waterHeight - holeHeight)
}

/** Ideal (inviscid) Torricelli efflux speed √(2gH) (m·s⁻¹). */
export function torricelliVelocity(gravity: number, head: number): number {
  return Math.sqrt(2 * Math.max(gravity, 0) * Math.max(head, 0))
}

/** Actual jet speed at the vena contracta, C_d √(2gH) (m·s⁻¹). */
export function exitVelocity(state: FluidState): number {
  const head = effectiveHead(state.waterHeight, state.orifice.holeHeight)
  return state.orifice.dischargeCoefficient * torricelliVelocity(state.environment.gravity, head)
}

/** Volumetric discharge Q = C_d · a · √(2gH) (m³·s⁻¹). */
export function flowRate(state: FluidState): number {
  return orificeArea(state.orifice) * exitVelocity(state)
}

/** Mass flow rate ṁ = ρQ (kg·s⁻¹). */
export function massFlowRate(state: FluidState): number {
  return state.environment.fluidDensity * flowRate(state)
}

/** Hydrostatic gauge pressure at a depth `d` below the free surface (Pa). */
export function hydrostaticPressure(density: number, gravity: number, depth: number): number {
  return density * gravity * Math.max(depth, 0)
}

/** Reaction thrust on the vessel from the escaping jet, F = ρQv (N). */
export function jetThrust(state: FluidState): number {
  return state.environment.fluidDensity * flowRate(state) * exitVelocity(state)
}

/** Orifice Reynolds number Re = ρvD/μ (dimensionless). */
export function reynoldsNumber(state: FluidState): number {
  const { fluidDensity, viscosity } = state.environment
  const d = 2 * state.orifice.holeRadius
  return (fluidDensity * exitVelocity(state) * d) / Math.max(viscosity, EPS)
}

/**
 * Right-hand side of the draining ODE: dh/dt (m·s⁻¹).
 * Returns 0 once the level reaches the orifice, or while `refill` holds the
 * head constant (steady-flow experiment).
 */
export function levelDerivative(state: FluidState, h: number): number {
  if (state.environment.refill) return 0
  const head = effectiveHead(h, state.orifice.holeHeight)
  if (head <= EPS) return 0
  const v = state.orifice.dischargeCoefficient * torricelliVelocity(state.environment.gravity, head)
  const area = crossSectionArea(state.vessel, h)
  if (area <= EPS) return 0
  return -(orificeArea(state.orifice) * v) / area
}

/**
 * Advance the water level by `dt` with a classic 4th-order Runge–Kutta step.
 * The √H term has an infinite slope as H → 0, so the result is clamped to the
 * orifice height to keep the solution physical near depletion.
 */
export function integrateLevel(state: FluidState, dt: number): number {
  const h0 = state.waterHeight
  if (dt <= 0) return h0
  const f = (h: number) => levelDerivative(state, h)

  const k1 = f(h0)
  const k2 = f(h0 + (dt / 2) * k1)
  const k3 = f(h0 + (dt / 2) * k2)
  const k4 = f(h0 + dt * k3)
  const next = h0 + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4)

  return clamp(next, state.orifice.holeHeight, state.vessel.height)
}

/* ------------------------------------------------------------------ *
 * Closed-form reference (constant cross-section only)
 * ------------------------------------------------------------------ */

/** True when A(h) does not depend on h, i.e. a closed form exists. */
export function hasConstantCrossSection(vessel: VesselParams): boolean {
  return vessel.shape !== 'cone' || Math.abs(vessel.taper - 1) < 1e-6
}

/**
 * Analytic solution of the draining ODE for a prismatic vessel:
 *
 *     h(t) = y + ( √H₀ − (C_d a √(2g)) / (2A) · t )²
 */
export function analyticLevel(state: FluidState, h0: number, t: number): number {
  const { vessel, orifice, environment } = state
  const y = orifice.holeHeight
  const head0 = effectiveHead(h0, y)
  if (environment.refill) return h0
  if (head0 <= EPS || environment.gravity <= EPS) return h0

  const A = crossSectionArea(vessel, h0)
  const a = orificeArea(orifice)
  const k = (orifice.dischargeCoefficient * a * Math.sqrt(2 * environment.gravity)) / (2 * A)
  const root = Math.sqrt(head0) - k * t
  return root <= 0 ? y : y + root * root
}

/**
 * Time still needed to drain to the orifice, computed with A frozen at its
 * current value. Exact for prismatic vessels; for a tapered one it is a local
 * approximation that becomes exact as H → 0, which is precisely where the
 * √H singularity makes a fixed-step integrator lose accuracy. Used to finish
 * the last step analytically instead of stepping into the singularity.
 */
export function localDrainTime(state: FluidState, h: number): number {
  const { orifice, environment } = state
  const head = effectiveHead(h, orifice.holeHeight)
  if (head <= EPS || environment.gravity <= EPS) return 0
  const A = crossSectionArea(state.vessel, h)
  const a = orificeArea(orifice)
  return (2 * A * Math.sqrt(head)) / (orifice.dischargeCoefficient * a * Math.sqrt(2 * environment.gravity))
}

/** Analytic emptying time t_e = (A / (C_d a)) √(2H₀/g) (s). */
export function analyticEmptyTime(state: FluidState, h0: number): number {
  const { vessel, orifice, environment } = state
  const head0 = effectiveHead(h0, orifice.holeHeight)
  if (head0 <= EPS || environment.gravity <= EPS || environment.refill) return Infinity
  const A = crossSectionArea(vessel, h0)
  const a = orificeArea(orifice)
  return (A / (orifice.dischargeCoefficient * a)) * Math.sqrt((2 * head0) / environment.gravity)
}

/* ------------------------------------------------------------------ *
 * Numerical reference curve (works for every vessel shape)
 * ------------------------------------------------------------------ */

export interface ReferenceCurve {
  /** Uniform time step of the table (s). */
  dt: number
  /** Water height samples (m), index i ↔ t = i·dt. */
  heights: Float64Array
  /** Time at which the level reaches the orifice (s); Infinity if never. */
  emptyTime: number
  /** True when the table was produced by the closed form rather than RK4. */
  analytic: boolean
}

/**
 * Pre-integrate the full drain with a fine fixed step so the analytics panel
 * can plot "theory" against the live simulation without re-solving per frame.
 * The table is capped at `maxTime` seconds of simulated time.
 */
export function buildReferenceCurve(
  state: FluidState,
  h0: number,
  maxTime = 600,
  targetSamples = 4000,
): ReferenceCurve {
  const analytic = hasConstantCrossSection(state.vessel)
  const y = state.orifice.holeHeight

  if (state.environment.refill) {
    const heights = new Float64Array(2)
    heights[0] = h0
    heights[1] = h0
    return { dt: maxTime, heights, emptyTime: Infinity, analytic: true }
  }

  const predicted = analytic ? analyticEmptyTime(state, h0) : estimateEmptyTime(state, h0)
  const span = Math.min(maxTime, Number.isFinite(predicted) ? predicted * 1.08 + 1 : maxTime)

  // The step is sized to the run, not fixed: this table is rebuilt on every
  // tick of a geometry slider, and a fixed 1/240 s step on a slow-draining
  // tank would churn megabytes per second of Float64Array. `targetSamples`
  // resolves the chart far beyond its ~360 plotted points while keeping each
  // rebuild at ~32 kB.
  const dt = clamp(span / targetSamples, 1 / 240, 1 / 20)
  const steps = Math.max(2, Math.min(targetSamples + 1, Math.ceil(span / dt) + 1))

  const heights = new Float64Array(steps)
  let emptyTime = Infinity
  let h = h0
  const scratch: FluidState = { ...state, waterHeight: h0 }

  // Prismatic vessels have an exact solution — use it. The chart labels this
  // series "theory", so it should be the closed form itself, not a fine RK4
  // solution standing in for one.
  if (analytic) {
    for (let i = 0; i < steps; i++) heights[i] = analyticLevel(state, h0, i * dt)
    return { dt, heights, emptyTime: analyticEmptyTime(state, h0), analytic }
  }

  for (let i = 0; i < steps; i++) {
    heights[i] = h
    scratch.waterHeight = h

    // Finish the final step analytically. Stepping RK4 into H → 0, where
    // d/dh √(h−y) diverges, would report the tank as empty ~0.1 % early.
    if (emptyTime === Infinity) {
      const remaining = localDrainTime(scratch, h)
      if (h - y <= 1e-12) emptyTime = i * dt
      else if (remaining <= dt) emptyTime = i * dt + remaining
    }

    h = integrateLevel(scratch, dt)
  }

  return { dt, heights, emptyTime, analytic }
}

/** Linear interpolation into a reference table (m). */
export function sampleReference(curve: ReferenceCurve, t: number): number {
  const { heights, dt } = curve
  if (heights.length === 0) return 0
  if (t <= 0) return heights[0]
  const idx = t / dt
  const i = Math.floor(idx)
  if (i >= heights.length - 1) return heights[heights.length - 1]
  const frac = idx - i
  return heights[i] * (1 - frac) + heights[i + 1] * frac
}

/**
 * Coarse emptying-time estimate used to size the reference table for vessels
 * without a closed form. Integrates the ODE with a large step; only the
 * magnitude matters here.
 */
export function estimateEmptyTime(state: FluidState, h0: number): number {
  const y = state.orifice.holeHeight
  if (effectiveHead(h0, y) <= EPS || state.environment.gravity <= EPS) return Infinity
  const scratch: FluidState = { ...state, waterHeight: h0 }
  const dt = 1 / 120
  let t = 0
  let h = h0
  while (h - y > 1e-9 && t < 3600) {
    scratch.waterHeight = h
    const remaining = localDrainTime(scratch, h)
    if (remaining <= dt) return t + remaining
    h = integrateLevel(scratch, dt)
    t += dt
  }
  return t
}

/* ------------------------------------------------------------------ *
 * Projectile kinematics of the jet
 * ------------------------------------------------------------------ */

/**
 * Horizontal reach of an ideal (drag-free) jet leaving a hole at height y with
 * speed v, landing on the floor plane:
 *
 *     R = v √(2y/g) = 2 C_d √( y (h − y) )
 *
 * which is maximised at y = h/2 with R_max = C_d·h — the classic result.
 */
export function jetRange(velocity: number, holeHeight: number, gravity: number): number {
  if (velocity <= EPS) return 0
  // In zero-g a moving jet never returns to the floor plane.
  if (gravity <= EPS) return Infinity
  return velocity * Math.sqrt((2 * Math.max(holeHeight, 0)) / gravity)
}

/** Hole height that maximises the reach for a given fill level (m). */
export function optimalHoleHeight(waterHeight: number): number {
  return waterHeight / 2
}

/** Time of flight of a drag-free parcel from the orifice to the floor (s). */
export function timeOfFlight(holeHeight: number, gravity: number): number {
  if (gravity <= EPS) return Infinity
  return Math.sqrt((2 * Math.max(holeHeight, 0)) / gravity)
}

/**
 * Analytic drag-free trajectory of the jet centreline, sampled for the 3D
 * overlay. Returns points in the (horizontal, vertical) plane, metres.
 */
export function jetTrajectory(
  velocity: number,
  holeHeight: number,
  gravity: number,
  samples = 48,
): CurvePoint[] {
  const pts: CurvePoint[] = []
  const tf = Number.isFinite(timeOfFlight(holeHeight, gravity))
    ? timeOfFlight(holeHeight, gravity)
    : 3
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * tf
    pts.push({ x: velocity * t, y: holeHeight - 0.5 * gravity * t * t })
  }
  return pts
}

/* ------------------------------------------------------------------ *
 * Bernoulli bookkeeping (for the research panel)
 * ------------------------------------------------------------------ */

export interface BernoulliTerms {
  /** ρgh at the free surface, relative to the orifice (Pa). */
  elevation: number
  /** ½ρv² at the orifice (Pa). */
  dynamic: number
  /** Head loss implied by C_d < 1 (Pa). */
  loss: number
  /** Fraction of the available head converted into kinetic energy. */
  efficiency: number
}

export function bernoulliBudget(state: FluidState): BernoulliTerms {
  const { environment: env, orifice } = state
  const head = effectiveHead(state.waterHeight, orifice.holeHeight)
  const elevation = env.fluidDensity * env.gravity * head
  const v = exitVelocity(state)
  const dynamic = 0.5 * env.fluidDensity * v * v
  return {
    elevation,
    dynamic,
    loss: Math.max(0, elevation - dynamic),
    efficiency: elevation > EPS ? dynamic / elevation : 0,
  }
}

/* ------------------------------------------------------------------ *
 * Telemetry assembly
 * ------------------------------------------------------------------ */

export function computeHydroTelemetry(state: FluidState, initialFill: number): HydroTelemetry {
  const { vessel, orifice, environment: env } = state
  const head = effectiveHead(state.waterHeight, orifice.holeHeight)
  const v = exitVelocity(state)
  const drainable = Math.max(EPS, initialFill - orifice.holeHeight)

  return {
    waterHeight: state.waterHeight,
    head,
    exitVelocity: v,
    flowRate: orificeArea(orifice) * v,
    volume: liquidVolume(vessel, state.waterHeight),
    pressureAtOrifice: hydrostaticPressure(env.fluidDensity, env.gravity, head),
    pressureAtFloor: hydrostaticPressure(env.fluidDensity, env.gravity, state.waterHeight),
    jetRange: jetRange(v, orifice.holeHeight, env.gravity),
    reynolds: reynoldsNumber(state),
    timeToEmpty: hasConstantCrossSection(vessel)
      ? analyticEmptyTime(state, state.waterHeight)
      : estimateEmptyTime(state, state.waterHeight),
    drainedFraction: clamp((initialFill - state.waterHeight) / drainable, 0, 1),
  }
}

/* ------------------------------------------------------------------ *
 * Small shared helpers
 * ------------------------------------------------------------------ */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
