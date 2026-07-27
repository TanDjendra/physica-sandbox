/**
 * calculusEngine — pure differential calculus for the box-folding module.
 *
 * ── Problem ─────────────────────────────────────────────────────────────────
 * A rectangular sheet W × L has a square of side x removed from each corner;
 * the four flaps are folded up to form an open-topped box. Its volume is
 *
 *     V(x) = (W − 2x)(L − 2x)·x  =  4x³ − 2(W + L)x² + W L x ,   0 < x < min(W,L)/2
 *
 *     V′(x) = 12x² − 4(W + L)x + W L
 *     V″(x) = 24x − 4(W + L)
 *
 * Setting V′(x) = 0 and taking the root inside the feasible domain gives
 *
 *     x* = [ (W + L) − √(W² − W L + L²) ] / 6
 *
 * (the "+" root always exceeds min(W,L)/2 and is geometrically impossible).
 * For a square sheet W = L = a this collapses to the familiar x* = a/6.
 *
 * The engine deliberately solves the same problem three independent ways —
 * closed form, bisection on V′, and golden-section search on V — so the
 * research panel can display a genuine numerical residual instead of asking
 * the user to trust a single formula.
 */

import type { CalculusParams, CalculusTelemetry, CurvePoint, OptimisationResult } from '../types'

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

/** V(x) = (W − 2x)(L − 2x)x. Returns 0 outside the feasible domain. */
export function boxVolume(width: number, length: number, x: number): number {
  const w = width - 2 * x
  const l = length - 2 * x
  if (x <= 0 || w <= 0 || l <= 0) return 0
  return w * l * x
}

/** V′(x) = 12x² − 4(W + L)x + WL. */
export function boxVolumeDerivative(width: number, length: number, x: number): number {
  return 12 * x * x - 4 * (width + length) * x + width * length
}

/** V″(x) = 24x − 4(W + L). */
export function boxVolumeSecondDerivative(width: number, length: number, x: number): number {
  return 24 * x - 4 * (width + length)
}

/** Footprint of the folded box, (W − 2x)(L − 2x). */
export function boxBaseArea(width: number, length: number, x: number): number {
  return Math.max(0, width - 2 * x) * Math.max(0, length - 2 * x)
}

/** Material remaining after the four corner squares are removed, WL − 4x². */
export function sheetAreaAfterCuts(width: number, length: number, x: number): number {
  return Math.max(0, width * length - 4 * x * x)
}

/** Upper bound of the feasible domain for x. */
export function feasibleDomain(width: number, length: number): number {
  return Math.min(width, length) / 2
}

/* ------------------------------------------------------------------ *
 * Generic numerical tools
 * ------------------------------------------------------------------ */

/** Central-difference derivative — O(h²) accurate. */
export function numericDerivative(f: (x: number) => number, x: number, h = 1e-5): number {
  return (f(x + h) - f(x - h)) / (2 * h)
}

/** Central-difference second derivative — O(h²) accurate. */
export function numericSecondDerivative(f: (x: number) => number, x: number, h = 1e-4): number {
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h)
}

/**
 * Bisection root finder on a bracketing interval. Returns `null` when the
 * endpoints do not straddle a sign change, which keeps the caller honest.
 */
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-12,
  maxIter = 200,
): number | null {
  let a = lo
  let b = hi
  let fa = f(a)
  const fb = f(b)
  if (fa === 0) return a
  if (fb === 0) return b
  if (fa * fb > 0) return null

  for (let i = 0; i < maxIter && (b - a) / 2 > tol; i++) {
    const mid = (a + b) / 2
    const fm = f(mid)
    if (fm === 0) return mid
    if (fa * fm < 0) {
      b = mid
    } else {
      a = mid
      fa = fm
    }
  }
  return (a + b) / 2
}

/** Newton–Raphson refinement with a numeric Jacobian and a safety cage. */
export function newtonRefine(
  f: (x: number) => number,
  x0: number,
  lo: number,
  hi: number,
  tol = 1e-14,
  maxIter = 60,
): number {
  let x = x0
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x)
    if (Math.abs(fx) < tol) break
    const d = numericDerivative(f, x)
    if (!Number.isFinite(d) || Math.abs(d) < 1e-14) break
    const next = x - fx / d
    if (!Number.isFinite(next) || next <= lo || next >= hi) break
    if (Math.abs(next - x) < tol) {
      x = next
      break
    }
    x = next
  }
  return x
}

/**
 * Golden-section search for the maximum of a unimodal function on [lo, hi].
 * Derivative-free, so it is a genuinely independent check on the closed form.
 */
export function goldenSectionMax(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-10,
  maxIter = 300,
): number {
  const invPhi = (Math.sqrt(5) - 1) / 2
  let a = lo
  let b = hi
  let c = b - invPhi * (b - a)
  let d = a + invPhi * (b - a)
  let fc = f(c)
  let fd = f(d)

  for (let i = 0; i < maxIter && Math.abs(b - a) > tol; i++) {
    if (fc > fd) {
      b = d
      d = c
      fd = fc
      c = b - invPhi * (b - a)
      fc = f(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + invPhi * (b - a)
      fd = f(d)
    }
  }
  return (a + b) / 2
}

/** Uniformly sample a scalar function for plotting. */
export function sampleFunction(
  f: (x: number) => number,
  lo: number,
  hi: number,
  samples = 160,
): CurvePoint[] {
  const pts: CurvePoint[] = new Array(samples + 1)
  for (let i = 0; i <= samples; i++) {
    const x = lo + ((hi - lo) * i) / samples
    pts[i] = { x, y: f(x) }
  }
  return pts
}

/* ------------------------------------------------------------------ *
 * The optimiser
 * ------------------------------------------------------------------ */

/**
 * Solve max V(x) three ways and report the disagreement.
 * Closed form is authoritative; `residual` is the |analytic − numeric| gap and
 * should sit at machine-epsilon level for any sane (W, L).
 */
export function optimiseBox(width: number, length: number): OptimisationResult {
  const domainMax = feasibleDomain(width, length)
  const s = width + length
  const disc = Math.sqrt(width * width - width * length + length * length)

  const xOptimal = (s - disc) / 6
  const xRejected = (s + disc) / 6

  // Independent check 1 — bisect V′ on the feasible interval.
  const dV = (x: number) => boxVolumeDerivative(width, length, x)
  const bisected = bisect(dV, 1e-12, domainMax - 1e-12)
  // Independent check 2 — derivative-free search on V itself.
  const golden = goldenSectionMax((x) => boxVolume(width, length, x), 0, domainMax)
  const xNumeric = bisected === null ? golden : newtonRefine(dV, bisected, 0, domainMax)

  return {
    xOptimal,
    volumeMax: boxVolume(width, length, xOptimal),
    xRejected,
    secondDerivative: boxVolumeSecondDerivative(width, length, xOptimal),
    domainMax,
    xNumeric,
    residual: Math.abs(xOptimal - xNumeric),
  }
}

/** Nature of a critical point from the sign of V″. */
export function classifyCriticalPoint(
  secondDerivative: number,
): 'maximum' | 'minimum' | 'inflection' {
  if (secondDerivative < -1e-9) return 'maximum'
  if (secondDerivative > 1e-9) return 'minimum'
  return 'inflection'
}

/* ------------------------------------------------------------------ *
 * Telemetry assembly
 * ------------------------------------------------------------------ */

export function computeCalculusTelemetry(params: CalculusParams): CalculusTelemetry {
  const { sheetWidth: w, sheetLength: l, cut: x } = params
  const optimum = optimiseBox(w, l)
  const volume = boxVolume(w, l, x)

  return {
    volume,
    firstDerivative: boxVolumeDerivative(w, l, x),
    secondDerivative: boxVolumeSecondDerivative(w, l, x),
    baseArea: boxBaseArea(w, l, x),
    surfaceArea: sheetAreaAfterCuts(w, l, x),
    efficiency: optimum.volumeMax > 0 ? volume / optimum.volumeMax : 0,
    optimum,
  }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

/** Human-readable expansion of V(x) with the current W and L substituted. */
export function expandedVolumePolynomial(width: number, length: number): string {
  const b = 2 * (width + length)
  const c = width * length
  return `V(x) = 4x^3 - ${fmt(b)}x^2 + ${fmt(c)}x`
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}
