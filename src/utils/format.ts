/** Number formatting helpers shared by every read-out in the UI. */

export function fixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(digits)
}

/** Compact engineering notation, e.g. 12 345 → "12.3k". */
export function compact(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '∞'
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(digits)}G`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(digits)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(digits)}k`
  if (abs > 0 && abs < 1e-3) return value.toExponential(digits)
  return value.toFixed(digits)
}

/** Pressure in Pa, promoted to kPa above 1 kPa. */
export function pressure(pa: number): string {
  if (!Number.isFinite(pa)) return '∞'
  return Math.abs(pa) >= 1000 ? `${(pa / 1000).toFixed(2)} kPa` : `${pa.toFixed(1)} Pa`
}

/** Volume in m³, promoted to litres below 0.1 m³. */
export function volume(m3: number): string {
  if (!Number.isFinite(m3)) return '∞'
  return m3 < 0.1 ? `${(m3 * 1000).toFixed(2)} L` : `${m3.toFixed(4)} m³`
}

/** Flow rate in m³·s⁻¹, promoted to L·s⁻¹ when small. */
export function flow(m3s: number): string {
  if (!Number.isFinite(m3s)) return '∞'
  return m3s < 0.05 ? `${(m3s * 1000).toFixed(2)} L/s` : `${m3s.toFixed(4)} m³/s`
}

/** Seconds → "m:ss.s" for longer runs, plain seconds otherwise. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞'
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}m ${s.toFixed(1)}s`
}

/** Round to a fixed number of significant digits (for LaTeX substitution). */
export function sig(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '\\infty'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e5 || abs < 1e-4) {
    const [mantissa, exponent] = value.toExponential(digits - 1).split('e')
    return `${mantissa}\\times 10^{${Number(exponent)}}`
  }
  return Number(value.toPrecision(digits)).toString()
}
