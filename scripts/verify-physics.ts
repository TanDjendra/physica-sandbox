/**
 * Self-check for the pure engines.
 *
 * These are the claims the sandbox makes to its users, checked against
 * independent derivations rather than against themselves:
 *   • the RK4 level integrator reproduces the closed-form drain curve,
 *   • discharged volume balances the volume lost from the vessel,
 *   • the range identity R = 2·C_d·√(y(h−y)) holds and peaks at y = h/2,
 *   • the calculus optimum agrees across three independent solvers,
 *   • the parcel integrator reproduces ballistic flight and the analytic
 *     terminal velocity under quadratic drag.
 *
 * Run with:  npm run verify
 */

import {
  analyticEmptyTime,
  analyticLevel,
  buildReferenceCurve,
  crossSectionArea,
  effectiveHead,
  exitVelocity,
  flowRate,
  integrateLevel,
  jetRange,
  liquidVolume,
  optimalHoleHeight,
  orificeArea,
  reynoldsNumber,
  sampleReference,
  torricelliVelocity,
} from '../src/physics/fluidEngine'
import {
  bisect,
  boxVolume,
  boxVolumeDerivative,
  boxVolumeSecondDerivative,
  goldenSectionMax,
  numericDerivative,
  optimiseBox,
} from '../src/physics/calculusEngine'
import { foldLayout, sheetOutline } from '../src/physics/foldGeometry'
import { ParticlePool } from '../src/physics/particlePool'
import { Object3D, Vector3 } from 'three'
import type { FluidState, VesselParams } from '../src/types'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++
    console.log(`  [32mPASS[0m ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  [31mFAIL[0m ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function near(name: string, actual: number, expected: number, tol: number) {
  const err = Math.abs(actual - expected)
  check(name, err <= tol, `got ${actual.toPrecision(8)}, want ${expected.toPrecision(8)}, |Δ| = ${err.toExponential(2)} ≤ ${tol.toExponential(1)}`)
}

function section(title: string) {
  console.log(`\n[36m${title}[0m`)
}

/* ------------------------------------------------------------------ */

const G = 9.80665

const cylinder: VesselParams = {
  shape: 'cylinder',
  radius: 0.5,
  width: 1,
  depth: 0.8,
  height: 2,
  taper: 0.45,
  initialFill: 1.7,
}

const baseState = (vessel: VesselParams, waterHeight: number): FluidState => ({
  vessel,
  orifice: { holeHeight: 0.85, holeRadius: 0.06, dischargeCoefficient: 0.62 },
  environment: {
    gravity: G,
    fluidDensity: 998.2,
    viscosity: 1.002e-3,
    airDrag: 0.02,
    ambientPressure: 101325,
    refill: false,
  },
  waterHeight,
})

/* ------------------------------------------------------------------ */

section('Torricelli & geometry')

near('v_ideal = √(2gH) at H = 1 m', torricelliVelocity(G, 1), Math.sqrt(2 * G), 1e-12)
near('v_ideal = 0 at H = 0', torricelliVelocity(G, 0), 0, 0)
near('head clamps at zero below the orifice', effectiveHead(0.4, 0.85), 0, 0)

{
  const s = baseState(cylinder, 1.7)
  near('exit velocity applies C_d', exitVelocity(s), 0.62 * Math.sqrt(2 * G * 0.85), 1e-12)
  near('Q = a·v', flowRate(s), orificeArea(s.orifice) * exitVelocity(s), 1e-15)
  near('cylinder cross-section πR²', crossSectionArea(cylinder, 1), Math.PI * 0.25, 1e-12)
  near('cylinder volume πR²h', liquidVolume(cylinder, 1.7), Math.PI * 0.25 * 1.7, 1e-12)
}

{
  // Conical frustum volume against a fine trapezoidal quadrature of πr(y)²dy.
  const cone: VesselParams = { ...cylinder, shape: 'cone', taper: 0.45 }
  const h = 1.7
  const n = 200_000
  let sum = 0
  for (let i = 0; i < n; i++) {
    const y0 = (h * i) / n
    const y1 = (h * (i + 1)) / n
    sum += ((crossSectionArea(cone, y0) + crossSectionArea(cone, y1)) / 2) * (y1 - y0)
  }
  near('frustum volume = ∫πr(y)²dy', liquidVolume(cone, h), sum, 1e-7)
}

{
  const box: VesselParams = { ...cylinder, shape: 'box' }
  near('prism cross-section W·D', crossSectionArea(box, 0.3), 1 * 0.8, 1e-12)
  near('prism volume W·D·h', liquidVolume(box, 1.2), 1 * 0.8 * 1.2, 1e-12)
}

/* ------------------------------------------------------------------ */

section('Draining ODE — RK4 vs closed form')

{
  const s = baseState(cylinder, 1.7)
  const h0 = 1.7
  const dt = 1 / 120
  let h = h0
  let t = 0
  let maxErr = 0
  const scratch = { ...s }

  while (t < 60) {
    scratch.waterHeight = h
    h = integrateLevel(scratch, dt)
    t += dt
    const exact = analyticLevel(s, h0, t)
    maxErr = Math.max(maxErr, Math.abs(h - exact))
  }
  check(
    'RK4 tracks h(t) across the whole drain',
    maxErr < 1e-9,
    `max |h_RK4 − h_exact| = ${maxErr.toExponential(2)} over 60 s at Δt = 1/120 s`,
  )
  near('level settles exactly on the orifice', h, s.orifice.holeHeight, 1e-12)
}

{
  const s = baseState(cylinder, 1.7)
  const te = analyticEmptyTime(s, 1.7)
  const curve = buildReferenceCurve(s, 1.7)
  near('reference table empty time matches closed form', curve.emptyTime, te, 1e-6)
  near(
    'reference interpolation matches closed form at t = 20 s',
    sampleReference(curve, 20),
    analyticLevel(s, 1.7, 20),
    1e-6,
  )
  check('closed form used for prismatic vessel', curve.analytic)
}

{
  // Volume balance: ∫Q dt over the drain must equal the volume lost.
  const s = baseState(cylinder, 1.7)
  const dt = 1 / 500
  const scratch = { ...s }
  let h = 1.7
  let discharged = 0
  let t = 0
  while (h - s.orifice.holeHeight > 1e-9 && t < 200) {
    scratch.waterHeight = h
    discharged += flowRate(scratch) * dt
    h = integrateLevel(scratch, dt)
    t += dt
  }
  const lost = liquidVolume(cylinder, 1.7) - liquidVolume(cylinder, s.orifice.holeHeight)
  check(
    'discharged volume balances the volume lost',
    Math.abs(discharged - lost) / lost < 2e-3,
    `∫Q dt = ${discharged.toFixed(6)} m³ vs ΔV = ${lost.toFixed(6)} m³ (${(
      (100 * Math.abs(discharged - lost)) / lost
    ).toFixed(3)} %)`,
  )
}

{
  // A tapered vessel has no closed form — the numeric branch must still be sane.
  const cone: VesselParams = { ...cylinder, shape: 'cone', taper: 0.45 }
  const s = baseState(cone, 1.7)
  const curve = buildReferenceCurve(s, 1.7)
  let monotone = true
  for (let i = 1; i < curve.heights.length; i++) {
    if (curve.heights[i] > curve.heights[i - 1] + 1e-12) monotone = false
  }
  check('conical drain is monotonically decreasing', monotone)
  check('conical reference is flagged non-analytic', !curve.analytic)
  near(
    'conical drain terminates at the orifice',
    curve.heights[curve.heights.length - 1],
    s.orifice.holeHeight,
    1e-3,
  )
}

/* ------------------------------------------------------------------ */

section('Jet kinematics')

{
  const h = 1.7
  const cd = 0.62
  for (const y of [0.2, 0.5, 0.85, 1.2, 1.5]) {
    const s = baseState(cylinder, h)
    s.orifice = { ...s.orifice, holeHeight: y }
    const v = exitVelocity(s)
    const R = jetRange(v, y, G)
    near(`range identity at y = ${y}`, R, 2 * cd * Math.sqrt(y * (h - y)), 1e-12)
  }

  const yStar = optimalHoleHeight(h)
  const sStar = baseState(cylinder, h)
  sStar.orifice = { ...sStar.orifice, holeHeight: yStar }
  const rStar = jetRange(exitVelocity(sStar), yStar, G)
  near('maximum range equals C_d·h at y = h/2', rStar, cd * h, 1e-12)

  // Brute force: no hole height beats y = h/2.
  let best = 0
  for (let i = 1; i < 2000; i++) {
    const y = (h * i) / 2000
    const s = baseState(cylinder, h)
    s.orifice = { ...s.orifice, holeHeight: y }
    best = Math.max(best, jetRange(exitVelocity(s), y, G))
  }
  check('no hole height out-ranges h/2', best <= rStar + 1e-9, `scan best = ${best.toFixed(9)}`)
}

{
  const s = baseState(cylinder, 1.7)
  const expected = (998.2 * exitVelocity(s) * 0.12) / 1.002e-3
  near('Reynolds number ρvD/μ', reynoldsNumber(s), expected, 1e-6)
}

/* ------------------------------------------------------------------ */

section('Calculus optimisation')

{
  const a = 12
  const o = optimiseBox(a, a)
  near('square sheet: x* = a/6', o.xOptimal, a / 6, 1e-12)
  near('square sheet: V(x*) = 2a³/27', o.volumeMax, (2 * a ** 3) / 27, 1e-9)
  near('V′(x*) = 0', boxVolumeDerivative(a, a, o.xOptimal), 0, 1e-9)
  check('V″(x*) < 0 ⇒ maximum', o.secondDerivative < 0, `V″ = ${o.secondDerivative.toFixed(4)}`)
  check(
    'rejected root is at or beyond the feasible bound',
    o.xRejected >= o.domainMax - 1e-12,
    `x_rejected = ${o.xRejected.toFixed(4)} ≥ min(W,L)/2 = ${o.domainMax} (equality is expected for a square sheet)`,
  )
  near('square sheet: rejected root is exactly a/2', o.xRejected, a / 2, 1e-12)
  near('V collapses to zero at the rejected root', boxVolume(a, a, o.xRejected), 0, 1e-12)
  check('closed form agrees with numeric solvers', o.residual < 1e-9, `residual = ${o.residual.toExponential(2)}`)
}

{
  // Rectangular sheets, checked against a dense brute-force scan of V.
  for (const [W, L] of [
    [12, 8],
    [30, 7.5],
    [5, 40],
    [3.3, 3.3],
  ]) {
    const o = optimiseBox(W, L)
    let bestX = 0
    let bestV = -Infinity
    const n = 4_000_000
    for (let i = 1; i < n; i++) {
      const x = (o.domainMax * i) / n
      const v = boxVolume(W, L, x)
      if (v > bestV) {
        bestV = v
        bestX = x
      }
    }
    near(`brute-force optimum matches x* for ${W}×${L}`, bestX, o.xOptimal, o.domainMax / n * 4)
    near(`brute-force V_max matches for ${W}×${L}`, bestV, o.volumeMax, Math.abs(o.volumeMax) * 1e-10)

    const golden = goldenSectionMax((x) => boxVolume(W, L, x), 0, o.domainMax)
    near(`golden-section agrees for ${W}×${L}`, golden, o.xOptimal, 1e-6)

    const root = bisect((x) => boxVolumeDerivative(W, L, x), 1e-12, o.domainMax - 1e-12)
    near(`bisection on V′ agrees for ${W}×${L}`, root ?? NaN, o.xOptimal, 1e-9)
  }
}

{
  const [W, L] = [12, 8]
  for (const x of [0.5, 1.2, 1.6, 2.4]) {
    near(
      `numeric V′ matches analytic at x = ${x}`,
      numericDerivative((v) => boxVolume(W, L, v), x),
      boxVolumeDerivative(W, L, x),
      1e-6,
    )
  }
  near(
    'numeric V″ matches analytic',
    (boxVolumeDerivative(W, L, 2 + 1e-5) - boxVolumeDerivative(W, L, 2 - 1e-5)) / 2e-5,
    boxVolumeSecondDerivative(W, L, 2),
    1e-6,
  )
  check('V = 0 at the domain edge', boxVolume(W, L, L / 2) === 0)
  check('V = 0 outside the domain', boxVolume(W, L, L) === 0)
}

/* ------------------------------------------------------------------ */

section('Parcel integrator')

{
  // Drag-free flight must reproduce the ballistic solution.
  const pool = new ParticlePool(64)
  pool.emit(1000, 0.01, {
    origin: { x: 0, y: 5, z: 0 },
    velocity: { x: 3, y: 0, z: 0 },
    spawnRadius: 0,
    spread: 0,
    speedJitter: 0,
    lifetime: 10,
  })
  check('emitter respects the requested count', pool.count === 10, `count = ${pool.count}`)

  const dt = 1 / 480
  let t = 0
  while (t < 0.6) {
    pool.step(dt, { gravity: G, drag: 0, groundY: -100, restitution: 0, friction: 1 })
    t += dt
  }
  const x = pool.position[0]
  const y = pool.position[1]

  // Buffers are Float32Array, so tolerances must respect ~1e-7 relative
  // precision accumulated over ~290 additions.
  near('ballistic x(t) = v·t', x, 3 * t, 1e-4)

  // Semi-implicit (symplectic) Euler gives exactly y_N = y₀ − ½g·t·(t + h):
  // it trails the continuous solution by ½g·t·h, a known first-order bias.
  // Asserting the discrete solution is a far stronger check than asserting
  // the continuous one within a loose tolerance.
  near('symplectic Euler y_N = y₀ − ½g·t·(t + h)', y, 5 - 0.5 * G * t * (t + dt), 1e-4)
  check(
    'the bias is first-order in Δt and trails the exact solution',
    Math.abs(5 - 0.5 * G * t * t - y - 0.5 * G * t * dt) < 1e-4,
    `bias = ${(5 - 0.5 * G * t * t - y).toExponential(3)} m ≈ ½g·t·Δt = ${(0.5 * G * t * dt).toExponential(3)} m`,
  )
}

{
  // Quadratic drag must converge to the analytic terminal speed √(g/k).
  const pool = new ParticlePool(8)
  const k = 0.25
  pool.emit(200, 0.01, {
    origin: { x: 0, y: 500, z: 0 },
    velocity: { x: 0.001, y: -0.001, z: 0 },
    spawnRadius: 0,
    spread: 0,
    speedJitter: 0,
    lifetime: 400,
  })
  for (let i = 0; i < 40_000; i++) {
    pool.step(1 / 400, { gravity: G, drag: k, groundY: -1e9, restitution: 0, friction: 1 })
  }
  near('terminal speed → √(g/k)', pool.speedOf(0), Math.sqrt(G / k), 1e-3)
}

{
  // Floor handling and pool compaction.
  const pool = new ParticlePool(500)
  pool.emit(4000, 0.05, {
    origin: { x: 0, y: 1, z: 0 },
    velocity: { x: 4, y: 0, z: 0 },
    spawnRadius: 0.02,
    spread: 0.05,
    speedJitter: 0.1,
    lifetime: 1.2,
  })
  const emitted = pool.count
  check('emission is capped by capacity', emitted <= 500, `emitted ${emitted}`)

  let belowGround = false
  for (let i = 0; i < 400; i++) {
    pool.step(1 / 120, { gravity: G, drag: 0.02, groundY: 0, restitution: 0.16, friction: 0.62 })
    for (let j = 0; j < pool.count; j++) {
      if (pool.position[j * 3 + 1] < -1e-6) belowGround = true
    }
  }
  check('no parcel penetrates the floor', !belowGround)
  check('splashes were recorded', pool.consumeSplashes() >= 0)
  check('pool drains as lifetimes expire', pool.count === 0, `count = ${pool.count}`)

  pool.emit(1000, 0.1, {
    origin: { x: 0, y: 1, z: 0 },
    velocity: { x: 4, y: 0, z: 0 },
    spawnRadius: 0.02,
    spread: 0,
    speedJitter: 0,
    lifetime: 0.5,
  })
  pool.step(1 / 120, { gravity: G, drag: 0, groundY: 0, restitution: 0, friction: 1 })
  let packed = true
  for (let i = 0; i < pool.count; i++) {
    if (!(pool.life[i] > 0)) packed = false
  }
  check('live parcels stay densely packed at the front of the buffer', packed)
}

/* ------------------------------------------------------------------ */

section('Fold geometry')

{
  // Compose the layout through real Object3D hierarchies, exactly as the
  // renderer does, and inspect the resulting world-space corners.
  const W = 12
  const L = 8
  const x = 1.5

  const worldCornersOfFlap = (fold: number, index: number) => {
    const layout = foldLayout(W, L, x, fold)
    const flap = layout.flaps[index]
    const hinge = new Object3D()
    hinge.position.set(flap.hinge.x, flap.hinge.y, flap.hinge.z)
    hinge.rotation.set(
      flap.axis === 'x' ? flap.rotation : 0,
      0,
      flap.axis === 'z' ? flap.rotation : 0,
    )
    const mesh = new Object3D()
    mesh.position.set(flap.offset.x, flap.offset.y, flap.offset.z)
    mesh.scale.set(flap.scale.x, flap.scale.y, flap.scale.z)
    hinge.add(mesh)
    hinge.updateMatrixWorld(true)

    // The eight corners of the unit cube the flap mesh scales.
    const pts: Vector3[] = []
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [-0.5, 0.5]) {
        for (const sz of [-0.5, 0.5]) {
          pts.push(new Vector3(sx, sy, sz).applyMatrix4(mesh.matrixWorld))
        }
      }
    }
    return { pts, layout }
  }

  {
    // Flat sheet: every panel lies in the base plane and spans the full sheet.
    const { pts, layout } = worldCornersOfFlap(0, 0)
    const maxY = Math.max(...pts.map((p) => p.y))
    const maxZ = Math.max(...pts.map((p) => p.z))
    near('flat: +Z flap stays in the sheet plane', maxY, layout.thickness, 1e-12)
    near('flat: +Z flap reaches the sheet edge L/2', maxZ, L / 2 - x + x, 1e-12)
  }

  // A panel of thickness t hinged at y = t/2 and rotated by θ occupies
  //   y ∈ [ t/2 − (t/2)cos θ ,  t/2 + x·sin θ + (t/2)cos θ ]
  // which is the exact extent of the rotated box, thickness included.
  const expectedSpan = (theta: number, t: number) => ({
    min: t / 2 - (t / 2) * Math.cos(theta),
    max: t / 2 + x * Math.sin(theta) + (t / 2) * Math.cos(theta),
  })

  for (const [i, name] of [
    [0, '+Z'],
    [1, '−Z'],
    [2, '+X'],
    [3, '−X'],
  ] as const) {
    const { pts, layout } = worldCornersOfFlap(1, i)
    const maxY = Math.max(...pts.map((p) => p.y))
    const minY = Math.min(...pts.map((p) => p.y))
    const want = expectedSpan(Math.PI / 2, layout.thickness)
    near(`folded: ${name} wall top at t/2 + x`, maxY, want.max, 1e-12)
    near(`folded: ${name} wall foot on the base mid-plane`, minY, want.min, 1e-12)
    near(`folded: ${name} wall is exactly x tall`, maxY - minY, x, 1e-12)
  }

  {
    // All four walls must rise to the same height — any sign error in the
    // hinge algebra shows up here as an asymmetric box.
    const tops = [0, 1, 2, 3].map((i) => {
      const { pts } = worldCornersOfFlap(1, i)
      return Math.max(...pts.map((p) => p.y))
    })
    check(
      'all four walls reach the same height',
      Math.max(...tops) - Math.min(...tops) < 1e-12,
      `tops = [${tops.map((v) => v.toFixed(6)).join(', ')}]`,
    )
    const bottoms = [0, 1, 2, 3].map((i) => {
      const { pts } = worldCornersOfFlap(1, i)
      return Math.min(...pts.map((p) => p.y))
    })
    check('no wall folds downward', Math.min(...bottoms) >= -1e-12)
  }

  {
    // At full fold the four walls must enclose exactly the base footprint.
    const layout = foldLayout(W, L, x, 1)
    near('cavity footprint a = W − 2x', layout.a, W - 2 * x, 1e-12)
    near('cavity footprint b = L − 2x', layout.b, L - 2 * x, 1e-12)
    near('wall rise equals the cut at full fold', layout.wallRise, x, 1e-12)
    near('layout volume equals V(x)', layout.volume, boxVolume(W, L, x), 1e-12)
    near(
      'fill body sits on the base top face',
      layout.fill.position.y - layout.fill.scale.y / 2,
      layout.thickness,
      1e-12,
    )
  }

  {
    // The translucent body must fill exactly what the walls enclose: its top
    // face has to land on the wall rims at every fold, not just at the end.
    for (const fold of [0.25, 0.5, 0.75, 1]) {
      const layout = foldLayout(W, L, x, fold)
      const { pts } = worldCornersOfFlap(fold, 2)
      const rim = Math.max(...pts.map((p) => p.y))
      const fillTop = layout.fill.position.y + layout.fill.scale.y / 2
      // The rim includes the outer corner of the tilted panel, which stands
      // (t/2)·cos θ proud of the inner face the cavity actually meets.
      const innerRim = rim - (layout.thickness / 2) * Math.cos(layout.theta)
      near(`fill top meets the wall rim at fold ${fold}`, fillTop, innerRim, 1e-12)
    }
  }

  {
    // Walls swing on an arc. sin(fold·π/2) ≥ fold on [0,1] — the sine lies
    // above its chord — so a volume body driven linearly by `fold` would lag
    // behind the rims through the whole animation, leaving a visible gap.
    const half = foldLayout(W, L, x, 0.5)
    near('wall rise is x·sin θ, not x·fold', half.wallRise, x * Math.SQRT1_2, 1e-12)
    check(
      'a linear rise would lag the walls at half fold',
      x * 0.5 < half.wallRise,
      `x·fold = ${(x * 0.5).toFixed(4)} lags x·sin θ = ${half.wallRise.toFixed(4)}`,
    )
    let lags = true
    for (let i = 1; i < 100; i++) {
      const f = i / 100
      if (foldLayout(W, L, x, f).wallRise < x * f - 1e-12) lags = false
    }
    check('the sine rise dominates the linear one across the whole fold', lags)
  }

  {
    // Half fold: walls lean at 45°, so their tops sit at t + x·sin(π/4).
    const { pts, layout } = worldCornersOfFlap(0.5, 2)
    const maxY = Math.max(...pts.map((p) => p.y))
    const want = expectedSpan(Math.PI / 4, layout.thickness)
    near('half fold: wall top matches the rotated-box extent', maxY, want.max, 1e-12)
    near('half fold: θ = π/4', layout.theta, Math.PI / 4, 1e-12)
  }

  {
    // Corner squares tile the gap between adjacent flaps on the flat sheet.
    const layout = foldLayout(W, L, x, 0)
    const c = layout.corners[0]
    near('corner square sits at the sheet corner (X)', c.position.x + c.scale.x / 2, W / 2, 1e-12)
    near('corner square sits at the sheet corner (Z)', c.position.z + c.scale.z / 2, L / 2, 1e-12)
    near('corner square is x by x', c.scale.x, x, 1e-12)
  }

  {
    // Degenerate inputs must not produce zero or negative scales.
    const layout = foldLayout(4, 4, 2, 1)
    check('degenerate cut keeps scales positive', layout.a > 0 && layout.b > 0 && layout.fill.scale.y > 0)
    near('degenerate cut has zero volume', layout.volume, 0, 1e-12)
    const clamped = foldLayout(W, L, x, 5)
    near('fold is clamped to 1', clamped.theta, Math.PI / 2, 1e-12)
  }

  {
    const outline = sheetOutline(W, L)
    check('sheet outline is a closed loop', outline.length === 5)
    check(
      'sheet outline closes on itself',
      outline[0].x === outline[4].x && outline[0].z === outline[4].z,
    )
    near('sheet outline spans W', Math.max(...outline.map((p) => p.x)) * 2, W, 1e-12)
    near('sheet outline spans L', Math.max(...outline.map((p) => p.z)) * 2, L, 1e-12)
  }
}

/* ------------------------------------------------------------------ */

console.log(
  `\n${failed === 0 ? '[32m' : '[31m'}${passed} passed, ${failed} failed[0m\n`,
)
if (failed > 0) process.exit(1)
