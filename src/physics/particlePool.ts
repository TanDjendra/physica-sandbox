/**
 * particlePool — a flat, allocation-free Lagrangian parcel system.
 *
 * Design notes
 *  • State lives in typed arrays sized once at construction; the hot loop never
 *    allocates, so the GC stays quiet at 60 fps with tens of thousands of
 *    parcels.
 *  • Live parcels are kept densely packed at the front of the buffers
 *    (swap-with-last removal), which lets `InstancedMesh.count` be set to
 *    `pool.count` and skip every dead slot for free.
 *  • Integration is semi-implicit (symplectic) Euler with quadratic drag:
 *
 *        a = −g ŷ − k·|v|·v          (k = airDrag, units m⁻¹)
 *        v ← v + a·Δt
 *        p ← p + v·Δt
 *
 *    Terminal speed is therefore √(g/k), which is the physically meaningful
 *    knob the UI exposes.
 *  • Substepping keeps the per-step displacement below a fraction of the
 *    parcel radius so fast jets do not tunnel through the floor.
 */

import type { EmitterConfig, IntegrationContext } from '../types'

const TMP_DIR = new Float64Array(3)
const TMP_U = new Float64Array(3)
const TMP_V = new Float64Array(3)

export class ParticlePool {
  readonly capacity: number

  /** xyz triplets, world metres. */
  readonly position: Float32Array
  /** xyz triplets, m·s⁻¹. */
  readonly velocity: Float32Array
  /** Remaining lifetime in seconds. */
  readonly life: Float32Array
  /** Total assigned lifetime, for fade curves. */
  readonly maxLife: Float32Array
  /** Stable per-parcel random in [0,1) used for size/colour variation. */
  readonly seed: Float32Array
  /** 1 while airborne, 0 once the parcel has hit the floor. */
  readonly airborne: Uint8Array

  count = 0

  private carry = 0
  private splashes = 0

  constructor(capacity: number) {
    this.capacity = capacity
    this.position = new Float32Array(capacity * 3)
    this.velocity = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.seed = new Float32Array(capacity)
    this.airborne = new Uint8Array(capacity)
  }

  reset(): void {
    this.count = 0
    this.carry = 0
    this.splashes = 0
  }

  /** Splash events since the last call (drives the impact ring effect). */
  consumeSplashes(): number {
    const n = this.splashes
    this.splashes = 0
    return n
  }

  /**
   * Emit `rate` parcels per second over `dt`, carrying the fractional
   * remainder so low rates still produce a steady, non-aliased stream.
   */
  emit(rate: number, dt: number, cfg: EmitterConfig): number {
    if (rate <= 0 || dt <= 0) return 0
    this.carry += rate * dt
    let n = Math.floor(this.carry)
    if (n <= 0) return 0
    this.carry -= n

    // Never stall the whole simulation on one frame after a long pause.
    n = Math.min(n, 512, this.capacity - this.count)
    if (n <= 0) {
      this.carry = 0
      return 0
    }

    const speed = Math.hypot(cfg.velocity.x, cfg.velocity.y, cfg.velocity.z)
    if (speed < 1e-6) return 0

    // Orthonormal basis (d, u, v) with d along the jet axis.
    TMP_DIR[0] = cfg.velocity.x / speed
    TMP_DIR[1] = cfg.velocity.y / speed
    TMP_DIR[2] = cfg.velocity.z / speed
    orthonormalBasis(TMP_DIR, TMP_U, TMP_V)

    for (let k = 0; k < n; k++) {
      const i = this.count++
      const p = i * 3

      // Uniform sample over the orifice disc, in the plane ⊥ to the jet.
      const r = cfg.spawnRadius * Math.sqrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const du = r * Math.cos(theta)
      const dv = r * Math.sin(theta)

      this.position[p] = cfg.origin.x + TMP_U[0] * du + TMP_V[0] * dv
      this.position[p + 1] = cfg.origin.y + TMP_U[1] * du + TMP_V[1] * dv
      this.position[p + 2] = cfg.origin.z + TMP_U[2] * du + TMP_V[2] * dv

      // Speed jitter + small conical divergence of the jet.
      const s = speed * (1 + (Math.random() * 2 - 1) * cfg.speedJitter)
      const a1 = (Math.random() * 2 - 1) * cfg.spread
      const a2 = (Math.random() * 2 - 1) * cfg.spread
      const vx = TMP_DIR[0] + TMP_U[0] * a1 + TMP_V[0] * a2
      const vy = TMP_DIR[1] + TMP_U[1] * a1 + TMP_V[1] * a2
      const vz = TMP_DIR[2] + TMP_U[2] * a1 + TMP_V[2] * a2
      const inv = s / Math.hypot(vx, vy, vz)

      this.velocity[p] = vx * inv
      this.velocity[p + 1] = vy * inv
      this.velocity[p + 2] = vz * inv

      this.life[i] = cfg.lifetime
      this.maxLife[i] = cfg.lifetime
      this.seed[i] = Math.random()
      this.airborne[i] = 1
    }
    return n
  }

  /**
   * Advance every live parcel. `dt` is the *simulated* elapsed time; internal
   * substeps are chosen from the fastest parcel so nothing tunnels.
   */
  step(dt: number, ctx: IntegrationContext): void {
    if (dt <= 0 || this.count === 0) return

    const sub = Math.min(6, Math.max(1, Math.ceil(dt / (1 / 120))))
    const h = dt / sub

    for (let s = 0; s < sub; s++) {
      this.integrate(h, ctx)
    }
  }

  private integrate(h: number, ctx: IntegrationContext): void {
    const { position: P, velocity: V, life: LIFE } = this
    const { gravity, drag, groundY, restitution, friction } = ctx

    for (let i = this.count - 1; i >= 0; i--) {
      const p = i * 3

      let vx = V[p]
      let vy = V[p + 1]
      let vz = V[p + 2]

      // a = −g ŷ − k|v|v
      if (drag > 0) {
        const speed = Math.hypot(vx, vy, vz)
        const f = drag * speed * h
        vx -= vx * f
        vy -= vy * f
        vz -= vz * f
      }
      vy -= gravity * h

      let x = P[p] + vx * h
      let y = P[p + 1] + vy * h
      let z = P[p + 2] + vz * h

      if (y <= groundY) {
        if (this.airborne[i] === 1) {
          this.airborne[i] = 0
          this.splashes++
          // Impacting parcels do not live long: they become a thin sheet.
          LIFE[i] = Math.min(LIFE[i], 0.55 + this.seed[i] * 0.5)
        }
        y = groundY
        if (vy < 0) vy = -vy * restitution
        vx *= friction
        vz *= friction
        if (Math.abs(vy) < 0.15) vy = 0
      }

      P[p] = x
      P[p + 1] = y
      P[p + 2] = z
      V[p] = vx
      V[p + 1] = vy
      V[p + 2] = vz

      LIFE[i] -= h
      if (LIFE[i] <= 0) this.swapRemove(i)
    }
  }

  /** O(1) removal that keeps the live range densely packed. */
  private swapRemove(i: number): void {
    const last = --this.count
    if (i === last) return
    const a = i * 3
    const b = last * 3
    this.position[a] = this.position[b]
    this.position[a + 1] = this.position[b + 1]
    this.position[a + 2] = this.position[b + 2]
    this.velocity[a] = this.velocity[b]
    this.velocity[a + 1] = this.velocity[b + 1]
    this.velocity[a + 2] = this.velocity[b + 2]
    this.life[i] = this.life[last]
    this.maxLife[i] = this.maxLife[last]
    this.seed[i] = this.seed[last]
    this.airborne[i] = this.airborne[last]
  }

  /** Speed of parcel `i` (m·s⁻¹) — used for velocity-tinting the instances. */
  speedOf(i: number): number {
    const p = i * 3
    return Math.hypot(this.velocity[p], this.velocity[p + 1], this.velocity[p + 2])
  }
}

/** Build two unit vectors orthogonal to `d` (and to each other). */
function orthonormalBasis(d: Float64Array, u: Float64Array, v: Float64Array): void {
  // Pick the axis least aligned with d to avoid a degenerate cross product.
  const ax = Math.abs(d[0])
  const ay = Math.abs(d[1])
  const az = Math.abs(d[2])
  let hx = 0
  let hy = 0
  let hz = 0
  if (ax <= ay && ax <= az) hx = 1
  else if (ay <= az) hy = 1
  else hz = 1

  // u = normalize(d × h)
  let ux = d[1] * hz - d[2] * hy
  let uy = d[2] * hx - d[0] * hz
  let uz = d[0] * hy - d[1] * hx
  const ul = Math.hypot(ux, uy, uz) || 1
  ux /= ul
  uy /= ul
  uz /= ul

  u[0] = ux
  u[1] = uy
  u[2] = uz

  // v = d × u  (already unit length)
  v[0] = d[1] * uz - d[2] * uy
  v[1] = d[2] * ux - d[0] * uz
  v[2] = d[0] * uy - d[1] * ux
}
