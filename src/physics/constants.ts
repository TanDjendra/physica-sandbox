import type { GravityBody } from '../types'

/** Standard gravity fields (m·s⁻²) used by the environment presets. */
export const GRAVITY: Record<Exclude<GravityBody, 'custom'>, number> = {
  earth: 9.80665,
  moon: 1.62,
  mars: 3.721,
  jupiter: 24.79,
  zero: 0,
}

export const GRAVITY_LABELS: Record<GravityBody, string> = {
  earth: 'Earth',
  moon: 'Moon',
  mars: 'Mars',
  jupiter: 'Jupiter',
  zero: 'Zero-G',
  custom: 'Custom',
}

/** Fluid presets: density ρ (kg·m⁻³) and dynamic viscosity μ (Pa·s) @ ~20 °C. */
export const FLUIDS = {
  water: { label: 'Water', density: 998.2, viscosity: 1.002e-3, color: '#38bdf8' },
  seawater: { label: 'Seawater', density: 1025, viscosity: 1.07e-3, color: '#22d3ee' },
  oil: { label: 'Olive oil', density: 911, viscosity: 8.4e-2, color: '#facc15' },
  glycerin: { label: 'Glycerin', density: 1261, viscosity: 1.412, color: '#f472b6' },
  mercury: { label: 'Mercury', density: 13534, viscosity: 1.526e-3, color: '#cbd5e1' },
} as const

export type FluidKey = keyof typeof FLUIDS

/** Sea-level atmospheric pressure (Pa). */
export const P_ATM = 101_325

/**
 * Typical discharge coefficients — shown as hints in the control panel.
 * C_d bundles the vena-contracta area reduction with viscous losses.
 */
export const DISCHARGE_HINTS = [
  { label: 'Sharp-edged orifice', value: 0.62 },
  { label: 'Rounded / bell-mouth', value: 0.98 },
  { label: 'Short tube (L≈2.5d)', value: 0.81 },
  { label: 'Ideal (inviscid)', value: 1.0 },
] as const

/** Hard ceiling on the instanced particle buffer. */
export const MAX_PARTICLES = 20_000

/** Fixed physics timestep (s). The renderer may run faster or slower. */
export const FIXED_DT = 1 / 120

/** Guard against the spiral of death after a tab-switch stall. */
export const MAX_SUBSTEPS = 8

export const EPS = 1e-9
