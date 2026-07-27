/**
 * simulationStore — the single reactive source of truth for *parameters*.
 *
 * Deliberate split of responsibilities:
 *   • This store holds values the user edits. It changes at human speed, so
 *     React re-renders here are cheap and welcome.
 *   • Per-frame integration state (water height, parcel buffers, elapsed time)
 *     lives in `runtime.ts` as plain mutable objects — writing it 120×/s must
 *     never touch React.
 *   • Derived numbers destined for the UI are published to `telemetryStore` on
 *     a throttled cadence (~12 Hz), which keeps charts and read-outs live
 *     without coupling them to the render loop.
 */

import { create } from 'zustand'
import type {
  CalculusParams,
  CameraPreset,
  EnvironmentParams,
  GravityBody,
  OrificeParams,
  SimulationModule,
  VesselParams,
} from '../types'
import { FLUIDS, GRAVITY, P_ATM, type FluidKey } from '../physics/constants'
import type { Locale } from '../i18n/strings'

export interface ViewParams {
  preset: CameraPreset
  showPressureField: boolean
  showVelocityVector: boolean
  showTrajectory: boolean
  crossSection: boolean
  showGrid: boolean
  showLabels: boolean
  shadows: boolean
  autoRotate: boolean
}

export interface ParticleParams {
  /** Parcels emitted per second at the reference (initial) flow rate. */
  emissionRate: number
  /** Rendered radius of one parcel (m). */
  particleRadius: number
  /** Hard cap on live parcels. */
  maxParticles: number
  /** Seconds a parcel survives. */
  lifetime: number
  /** Half-angle divergence of the jet (rad). */
  spread: number
  /** Fractional speed jitter (0–1). */
  speedJitter: number
}

export interface ClockParams {
  running: boolean
  timeScale: number
}

export interface SimulationState {
  module: SimulationModule
  vessel: VesselParams
  orifice: OrificeParams
  environment: EnvironmentParams
  calculus: CalculusParams
  view: ViewParams
  particles: ParticleParams
  clock: ClockParams
  locale: Locale

  /** Bumped on reset — components watching it re-seed their state. */
  resetToken: number
  /** Bumped when leva must be pushed new values from outside (presets). */
  syncToken: number
  /** Consumed by the integrator to advance exactly one fixed step. */
  stepPending: boolean

  setModule: (module: SimulationModule) => void
  setVessel: (patch: Partial<VesselParams>) => void
  setOrifice: (patch: Partial<OrificeParams>) => void
  setEnvironment: (patch: Partial<EnvironmentParams>) => void
  setCalculus: (patch: Partial<CalculusParams>) => void
  setView: (patch: Partial<ViewParams>) => void
  setParticles: (patch: Partial<ParticleParams>) => void

  play: () => void
  pause: () => void
  toggleRunning: () => void
  setTimeScale: (scale: number) => void
  requestStep: () => void
  consumeStep: () => void
  reset: () => void

  applyGravity: (body: GravityBody) => void
  applyFluid: (fluid: FluidKey) => void
  snapCutToOptimum: (x: number) => void
  restoreDefaults: () => void
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
}

/** Persist the language choice across reloads without pulling in a library. */
const LOCALE_KEY = 'physica.locale'
function loadLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    return v === 'id' || v === 'en' ? v : 'en'
  } catch {
    return 'en'
  }
}
function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

/* ------------------------------------------------------------------ *
 * Defaults — tuned so the default scene drains in ≈45 s at 1× and the
 * jet lands about one metre from the vessel: both easy to watch.
 * ------------------------------------------------------------------ */

export const DEFAULT_VESSEL: VesselParams = {
  shape: 'cylinder',
  radius: 0.5,
  width: 1.0,
  depth: 0.8,
  height: 2.0,
  taper: 0.45,
  initialFill: 1.7,
}

export const DEFAULT_ORIFICE: OrificeParams = {
  holeHeight: 0.85,
  holeRadius: 0.06,
  dischargeCoefficient: 0.62,
}

export const DEFAULT_ENVIRONMENT: EnvironmentParams = {
  gravity: GRAVITY.earth,
  fluidDensity: FLUIDS.water.density,
  viscosity: FLUIDS.water.viscosity,
  airDrag: 0.02,
  ambientPressure: P_ATM,
  refill: false,
}

export const DEFAULT_CALCULUS: CalculusParams = {
  sheetWidth: 12,
  sheetLength: 12,
  cut: 1.5,
  foldProgress: 1,
  autoFold: false,
  showOptimum: true,
}

export const DEFAULT_VIEW: ViewParams = {
  preset: 'isometric',
  showPressureField: true,
  showVelocityVector: true,
  showTrajectory: true,
  crossSection: false,
  showGrid: true,
  showLabels: true,
  shadows: true,
  autoRotate: false,
}

export const DEFAULT_PARTICLES: ParticleParams = {
  emissionRate: 2400,
  particleRadius: 0.014,
  maxParticles: 12_000,
  lifetime: 1.6,
  spread: 0.035,
  speedJitter: 0.06,
}

/** Shallow merge that skips the update when nothing actually changed. */
function mergeIfChanged<T extends object>(current: T, patch: Partial<T>): T | null {
  let dirty = false
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] !== undefined && !Object.is(current[key], patch[key])) {
      dirty = true
      break
    }
  }
  return dirty ? { ...current, ...patch } : null
}

export const useSimStore = create<SimulationState>((set, get) => ({
  module: 'hydrodynamics',
  vessel: { ...DEFAULT_VESSEL },
  orifice: { ...DEFAULT_ORIFICE },
  environment: { ...DEFAULT_ENVIRONMENT },
  calculus: { ...DEFAULT_CALCULUS },
  view: { ...DEFAULT_VIEW },
  particles: { ...DEFAULT_PARTICLES },
  clock: { running: true, timeScale: 1 },
  locale: loadLocale(),

  resetToken: 0,
  syncToken: 0,
  stepPending: false,

  setModule: (module) => {
    if (get().module === module) return
    set((s) => ({
      module,
      view: { ...s.view, preset: 'isometric' },
      resetToken: s.resetToken + 1,
    }))
  },

  setVessel: (patch) =>
    set((s) => {
      const vessel = mergeIfChanged(s.vessel, patch)
      if (!vessel) return {}
      // Keep dependent quantities inside their physical envelope.
      vessel.initialFill = Math.min(vessel.initialFill, vessel.height)
      const orifice = {
        ...s.orifice,
        holeHeight: Math.min(s.orifice.holeHeight, vessel.height * 0.95),
      }
      return { vessel, orifice, resetToken: s.resetToken + 1 }
    }),

  setOrifice: (patch) =>
    set((s) => {
      const orifice = mergeIfChanged(s.orifice, patch)
      if (!orifice) return {}
      orifice.holeHeight = Math.min(orifice.holeHeight, s.vessel.height * 0.95)
      return { orifice, resetToken: s.resetToken + 1 }
    }),

  setEnvironment: (patch) =>
    set((s) => {
      const environment = mergeIfChanged(s.environment, patch)
      return environment ? { environment } : {}
    }),

  setCalculus: (patch) =>
    set((s) => {
      const calculus = mergeIfChanged(s.calculus, patch)
      if (!calculus) return {}
      const maxCut = Math.min(calculus.sheetWidth, calculus.sheetLength) / 2
      const clamped = Math.min(calculus.cut, maxCut * 0.999)
      // Shrinking the sheet can force the cut down. Leva holds its own copy of
      // the slider value, so re-sync the panel — but only when the clamp
      // actually bit, otherwise every pixel of a W drag would remount it.
      const bit = clamped !== calculus.cut
      calculus.cut = clamped
      return bit ? { calculus, syncToken: s.syncToken + 1 } : { calculus }
    }),

  setView: (patch) =>
    set((s) => {
      const view = mergeIfChanged(s.view, patch)
      return view ? { view } : {}
    }),

  setParticles: (patch) =>
    set((s) => {
      const particles = mergeIfChanged(s.particles, patch)
      return particles ? { particles } : {}
    }),

  play: () => set((s) => (s.clock.running ? {} : { clock: { ...s.clock, running: true } })),
  pause: () => set((s) => (s.clock.running ? { clock: { ...s.clock, running: false } } : {})),
  toggleRunning: () => set((s) => ({ clock: { ...s.clock, running: !s.clock.running } })),
  setTimeScale: (timeScale) =>
    set((s) => (s.clock.timeScale === timeScale ? {} : { clock: { ...s.clock, timeScale } })),

  requestStep: () => set((s) => ({ stepPending: true, clock: { ...s.clock, running: false } })),
  consumeStep: () => set({ stepPending: false }),

  reset: () => set((s) => ({ resetToken: s.resetToken + 1 })),

  applyGravity: (body) => {
    if (body === 'custom') return
    set((s) => ({
      environment: { ...s.environment, gravity: GRAVITY[body] },
      syncToken: s.syncToken + 1,
    }))
  },

  applyFluid: (fluid) => {
    const f = FLUIDS[fluid]
    set((s) => ({
      environment: { ...s.environment, fluidDensity: f.density, viscosity: f.viscosity },
      syncToken: s.syncToken + 1,
    }))
  },

  snapCutToOptimum: (x) =>
    set((s) => ({ calculus: { ...s.calculus, cut: x }, syncToken: s.syncToken + 1 })),

  restoreDefaults: () =>
    set((s) => ({
      vessel: { ...DEFAULT_VESSEL },
      orifice: { ...DEFAULT_ORIFICE },
      environment: { ...DEFAULT_ENVIRONMENT },
      calculus: { ...DEFAULT_CALCULUS },
      view: { ...DEFAULT_VIEW, preset: s.view.preset },
      particles: { ...DEFAULT_PARTICLES },
      clock: { running: true, timeScale: 1 },
      resetToken: s.resetToken + 1,
      syncToken: s.syncToken + 1,
    })),

  setLocale: (locale) =>
    set((s) => {
      if (s.locale === locale) return {}
      saveLocale(locale)
      // Leva caches its labels at build time; bump syncToken so the headless
      // control components remount and re-read them in the new language.
      return { locale, syncToken: s.syncToken + 1 }
    }),

  toggleLocale: () => get().setLocale(get().locale === 'en' ? 'id' : 'en'),
}))

/** Non-reactive read for use inside `useFrame`. */
export const readSim = () => useSimStore.getState()
