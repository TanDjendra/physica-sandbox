/**
 * Central type contracts for the simulation sandbox.
 *
 * Everything that crosses the boundary between the pure physics layer
 * (`src/physics/*`) and the React/Three rendering layer is described here so a
 * change in the model is a compile-time event, not a runtime surprise.
 *
 * Unit convention (SI, strictly):
 *   length  m
 *   time    s
 *   mass    kg
 *   density kg·m⁻³
 *   speed   m·s⁻¹
 *   force   N
 *   pressure Pa
 */

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** A sampled point of any scalar function, used by the charting layer. */
export interface CurvePoint {
  x: number
  y: number
}

/* ------------------------------------------------------------------ *
 * Module selection & presentation
 * ------------------------------------------------------------------ */

export type SimulationModule = 'hydrodynamics' | 'calculus'

export type VesselShape = 'cylinder' | 'box' | 'cone'

export type CameraPreset = 'isometric' | 'front' | 'top' | 'orifice' | 'free'

export type GravityBody = 'earth' | 'moon' | 'mars' | 'jupiter' | 'zero' | 'custom'

/* ------------------------------------------------------------------ *
 * Module 1 — Hydrodynamics
 * ------------------------------------------------------------------ */

/**
 * Static geometry of the vessel. `radius`/`width`/`depth` are mutually
 * exclusive by shape but kept on one record so the UI can switch shapes
 * without losing the user's previous values.
 */
export interface VesselParams {
  shape: VesselShape
  /** Cylinder radius, or the *top* radius of the conical frustum (m). */
  radius: number
  /** Rectangular prism footprint along world X (m). */
  width: number
  /** Rectangular prism footprint along world Z (m). */
  depth: number
  /** Wall height of the vessel (m). Water level is clamped to this. */
  height: number
  /** Frustum bottom/top radius ratio for `shape === 'cone'` (0.05 – 1). */
  taper: number
  /** Initial water column height measured from the vessel floor (m). */
  initialFill: number
}

export interface OrificeParams {
  /** Height of the hole centre above the vessel floor (m). */
  holeHeight: number
  /** Radius of the circular orifice (m). */
  holeRadius: number
  /** Discharge coefficient C_d ∈ (0, 1]. Sharp-edged orifice ≈ 0.62. */
  dischargeCoefficient: number
}

export interface EnvironmentParams {
  /** Gravitational acceleration g (m·s⁻²). */
  gravity: number
  /** Fluid density ρ (kg·m⁻³). Water @20 °C ≈ 998. */
  fluidDensity: number
  /** Dynamic viscosity μ (Pa·s), used for the Reynolds diagnostic. */
  viscosity: number
  /** Quadratic air-drag factor k (m⁻¹): a_drag = −k·|v|·v. */
  airDrag: number
  /** Ambient/atmospheric pressure (Pa) — reported, not integrated. */
  ambientPressure: number
  /** Whether the tank is refilled to keep the head constant (steady flow). */
  refill: boolean
}

/** Everything the fluid solver needs, assembled once per frame. */
export interface FluidState {
  vessel: VesselParams
  orifice: OrificeParams
  environment: EnvironmentParams
  /** Current water column height above the vessel floor (m). */
  waterHeight: number
}

/** Derived scalars published to the analytics panel. */
export interface HydroTelemetry {
  waterHeight: number
  /** Effective head above the orifice, h − y (m). */
  head: number
  /** Efflux speed at the orifice (m·s⁻¹). */
  exitVelocity: number
  /** Volumetric flow rate Q (m³·s⁻¹). */
  flowRate: number
  /** Remaining liquid volume (m³). */
  volume: number
  /** Gauge pressure at the orifice depth (Pa). */
  pressureAtOrifice: number
  /** Hydrostatic pressure on the vessel floor (Pa). */
  pressureAtFloor: number
  /** Horizontal reach of the jet on the ground plane (m). */
  jetRange: number
  /** Orifice Reynolds number (dimensionless). */
  reynolds: number
  /** Predicted time for the level to reach the orifice (s). */
  timeToEmpty: number
  /** Fraction of the drainable column already discharged (0 – 1). */
  drainedFraction: number
}

/* ------------------------------------------------------------------ *
 * Module 2 — Calculus optimisation
 * ------------------------------------------------------------------ */

export interface CalculusParams {
  /** Sheet width W (arbitrary units, rendered as metres). */
  sheetWidth: number
  /** Sheet length L. */
  sheetLength: number
  /** Corner cut size x — the free variable being optimised. */
  cut: number
  /** 0 = flat sheet, 1 = fully folded open box. */
  foldProgress: number
  /** Drive the fold with an animated ping-pong instead of the slider. */
  autoFold: boolean
  /** Snap the cut slider to the analytic optimum. */
  showOptimum: boolean
}

/** Result of the optimisation solver for one (W, L) pair. */
export interface OptimisationResult {
  /** Critical point x* that maximises V (units of length). */
  xOptimal: number
  /** V(x*) — the maximum attainable volume. */
  volumeMax: number
  /**
   * The second root of V′(x) = 0. Always at or beyond the feasible bound
   * min(W, L)/2 — exactly equal to it for a square sheet, where it is the
   * degenerate x = a/2 that collapses the base to zero area.
   */
  xRejected: number
  /** V″(x*) < 0 confirms a maximum. */
  secondDerivative: number
  /** Upper bound of the feasible domain, min(W, L) / 2. */
  domainMax: number
  /** Independent bisection root of V′ — cross-check of the closed form. */
  xNumeric: number
  /** |x_analytic − x_numeric|, an honest residual for the research panel. */
  residual: number
}

export interface CalculusTelemetry {
  volume: number
  firstDerivative: number
  secondDerivative: number
  /** Base area (W − 2x)(L − 2x). */
  baseArea: number
  /** Outer surface area of the open box, WL − 4x². */
  surfaceArea: number
  /** V(x) / V(x*) ∈ [0, 1] — how close the user is to the optimum. */
  efficiency: number
  optimum: OptimisationResult
}

/* ------------------------------------------------------------------ *
 * Clock, transport & diagnostics
 * ------------------------------------------------------------------ */

export interface ClockState {
  running: boolean
  /** 1 = realtime, 0.25 = slow motion, 2 = fast forward. */
  timeScale: number
  /** Simulated seconds since the last reset. */
  elapsed: number
  /** Set by the "step" button; consumed by the integrator. */
  stepPending: boolean
}

export interface PerformanceTelemetry {
  fps: number
  frameTime: number
  particles: number
  drawCalls: number
  triangles: number
  programs: number
}

/** One row of the time-series recorder. */
export interface TimeSeriesSample {
  t: number
  /** Numerically integrated water height (m). */
  sim: number
  /** Closed-form / reference-integrated water height (m). */
  theory: number
  /** Instantaneous volumetric flow rate (m³·s⁻¹). */
  flow: number
  /** Efflux speed (m·s⁻¹). */
  velocity: number
}

/* ------------------------------------------------------------------ *
 * Particle system
 * ------------------------------------------------------------------ */

export interface EmitterConfig {
  origin: Vec3
  /** Mean jet velocity vector at the orifice (m·s⁻¹). */
  velocity: Vec3
  /** Radius of the emission disc (m) — the orifice mouth. */
  spawnRadius: number
  /** Half-angle cone spread applied to the velocity (rad). */
  spread: number
  /** Fractional random variation of the speed (0 – 1). */
  speedJitter: number
  /** Seconds a parcel survives after it stops moving. */
  lifetime: number
}

export interface IntegrationContext {
  gravity: number
  /** Quadratic drag factor k (m⁻¹). */
  drag: number
  /** World Y of the collision floor (m). */
  groundY: number
  restitution: number
  friction: number
}
