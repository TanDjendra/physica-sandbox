/**
 * foldGeometry — pure transform algebra for the folding-box scene.
 *
 * Kept out of the React component so the hinge maths can be tested in
 * isolation and the renderer is left with nothing but "copy these numbers onto
 * these Object3Ds".
 *
 * Frame: the base panel is centred on the origin, lying in the XZ plane with
 * its mid-plane at y = t/2 (t is the panel thickness). Its footprint is
 * a × b with a = W − 2x along X and b = L − 2x along Z.
 *
 * Each flap is a child of a hinge group placed on the corresponding base edge.
 * Rotating the hinge group by θ = (π/2)·fold lifts the flap:
 *
 *   +Z edge  hinge (0, t/2,  b/2)   rotation.x = −θ   flap offset (0, 0,  x/2)
 *   −Z edge  hinge (0, t/2, −b/2)   rotation.x = +θ   flap offset (0, 0, −x/2)
 *   +X edge  hinge ( a/2, t/2, 0)   rotation.z = +θ   flap offset ( x/2, 0, 0)
 *   −X edge  hinge (−a/2, t/2, 0)   rotation.z = −θ   flap offset (−x/2, 0, 0)
 *
 * Sign check for the +Z flap: rotating a point (0, 0, x/2) about X by α gives
 * y′ = −(x/2)·sin α, so α = −θ is what carries the flap upward. The other
 * three follow by symmetry, and `foldLayout` is verified against a full
 * Object3D composition in `scripts/verify-physics.ts`.
 */

import type { Vec3 } from '../types'

export type HingeAxis = 'x' | 'z'

export interface FlapTransform {
  /** World position of the hinge group. */
  hinge: Vec3
  axis: HingeAxis
  /** Signed rotation of the hinge group (rad). */
  rotation: number
  /** Flap mesh position inside the hinge group. */
  offset: Vec3
  /** Flap mesh scale (it is a unit box). */
  scale: Vec3
}

export interface BoxTransform {
  position: Vec3
  scale: Vec3
}

export interface FoldLayout {
  /** Base footprint along X, a = W − 2x. */
  a: number
  /** Base footprint along Z, b = L − 2x. */
  b: number
  /** Panel thickness. */
  thickness: number
  /** Fold angle θ ∈ [0, π/2]. */
  theta: number
  /**
   * Vertical rise of a wall's free edge above the hinge, x·sin θ.
   * Note this is *not* linear in `fold` — the flaps swing on an arc, so a
   * volume body driven by x·fold would climb faster than the walls and poke
   * through them mid-animation.
   */
  wallRise: number
  /**
   * Height of the cavity actually enclosed by the drawn panels, measured from
   * the top face of the base to the top of the walls. Because the panels are
   * rendered with a real thickness t while hinging on their mid-plane, this is
   * t/2 shorter than the idealised cut x. `volume` below always reports the
   * zero-thickness model V = (W−2x)(L−2x)x that the equations and charts use;
   * this field exists purely so the translucent body fills the drawn cavity
   * exactly instead of overshooting its rim.
   */
  cavityHeight: number
  /** Enclosed volume of the ideal (zero-thickness) box, V = a·b·x. */
  volume: number
  base: BoxTransform
  /** +Z, −Z, +X, −X, in that order. */
  flaps: [FlapTransform, FlapTransform, FlapTransform, FlapTransform]
  /** The four discarded corner squares, on the flat sheet. */
  corners: [BoxTransform, BoxTransform, BoxTransform, BoxTransform]
  /** Translucent body filling the cavity. */
  fill: BoxTransform
}

const MIN = 1e-4

/**
 * Compute every transform for one (W, L, x, fold) state.
 * `fold` is clamped to [0, 1]; degenerate cuts collapse to MIN rather than
 * producing zero-scale matrices, which Three.js cannot invert.
 */
export function foldLayout(
  width: number,
  length: number,
  cut: number,
  fold: number,
  thicknessRatio = 0.014,
): FoldLayout {
  const f = fold < 0 ? 0 : fold > 1 ? 1 : fold
  const x = Math.max(cut, MIN)
  const a = Math.max(width - 2 * cut, MIN)
  const b = Math.max(length - 2 * cut, MIN)
  const t = Math.max(width, length) * thicknessRatio
  const theta = f * (Math.PI / 2)
  const wallRise = x * Math.sin(theta)
  // Cavity spans from the base's top face (y = t) to the wall tops (t/2 + rise).
  const cavityHeight = Math.max(t / 2 + wallRise - t, 0)

  const flaps: FoldLayout['flaps'] = [
    {
      hinge: { x: 0, y: t / 2, z: b / 2 },
      axis: 'x',
      rotation: -theta,
      offset: { x: 0, y: 0, z: x / 2 },
      scale: { x: a, y: t, z: x },
    },
    {
      hinge: { x: 0, y: t / 2, z: -b / 2 },
      axis: 'x',
      rotation: theta,
      offset: { x: 0, y: 0, z: -x / 2 },
      scale: { x: a, y: t, z: x },
    },
    {
      hinge: { x: a / 2, y: t / 2, z: 0 },
      axis: 'z',
      rotation: theta,
      offset: { x: x / 2, y: 0, z: 0 },
      scale: { x, y: t, z: b },
    },
    {
      hinge: { x: -a / 2, y: t / 2, z: 0 },
      axis: 'z',
      rotation: -theta,
      offset: { x: -x / 2, y: 0, z: 0 },
      scale: { x, y: t, z: b },
    },
  ]

  const signs: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]
  const corners = signs.map(([sx, sz]) => ({
    position: { x: sx * (a / 2 + x / 2), y: t / 2, z: sz * (b / 2 + x / 2) },
    scale: { x, y: t * 0.9, z: x },
  })) as FoldLayout['corners']

  return {
    a,
    b,
    thickness: t,
    theta,
    wallRise,
    cavityHeight,
    volume: Math.max(width - 2 * cut, 0) * Math.max(length - 2 * cut, 0) * Math.max(cut, 0),
    base: { position: { x: 0, y: t / 2, z: 0 }, scale: { x: a, y: t, z: b } },
    flaps,
    corners,
    fill: {
      position: { x: 0, y: t + cavityHeight / 2, z: 0 },
      scale: { x: a, y: Math.max(cavityHeight, MIN), z: b },
    },
  }
}

/** Outline of the uncut sheet, as a closed polyline in the XZ plane. */
export function sheetOutline(width: number, length: number, y = 0.002): Vec3[] {
  const w = width / 2
  const l = length / 2
  return [
    { x: w, y, z: l },
    { x: w, y, z: -l },
    { x: -w, y, z: -l },
    { x: -w, y, z: l },
    { x: w, y, z: l },
  ]
}
