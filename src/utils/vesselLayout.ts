/**
 * Mapping between the physical vessel description and world-space geometry.
 *
 * World convention used by the whole 3D scene:
 *   • the vessel floor sits on the ground plane at y = 0,
 *   • the vessel axis is the world Y axis through the origin,
 *   • the orifice always faces +X, so the jet flies along +X.
 */

import * as THREE from 'three'
import type { OrificeParams, VesselParams, Vec3 } from '../types'
import { radiusAtHeight } from '../physics/fluidEngine'

/** Distance from the vessel axis to the inner wall at height `y` (m). */
export function wallDistanceAt(vessel: VesselParams, y: number): number {
  switch (vessel.shape) {
    case 'box':
      return vessel.width / 2
    case 'cylinder':
      return vessel.radius
    case 'cone':
      return radiusAtHeight(vessel, y)
  }
}

/** World position of the orifice mouth on the outer wall. */
export function orificeOrigin(vessel: VesselParams, orifice: OrificeParams): Vec3 {
  return {
    x: wallDistanceAt(vessel, orifice.holeHeight),
    y: orifice.holeHeight,
    z: 0,
  }
}

/** Largest horizontal half-extent of the vessel — used for camera framing. */
export function vesselHalfExtent(vessel: VesselParams): number {
  switch (vessel.shape) {
    case 'box':
      return Math.max(vessel.width, vessel.depth) / 2
    case 'cylinder':
      return vessel.radius
    case 'cone':
      return Math.max(vessel.radius, vessel.radius * vessel.taper)
  }
}

/**
 * Build the geometry for a vessel-shaped solid of the given height.
 * Shared by the transparent shell and the liquid body so the liquid always
 * follows the taper of a conical frustum exactly.
 */
export function buildVesselGeometry(
  vessel: VesselParams,
  height: number,
  radialSegments = 56,
): THREE.BufferGeometry {
  const h = Math.max(height, 1e-4)
  switch (vessel.shape) {
    case 'box':
      return new THREE.BoxGeometry(vessel.width, h, vessel.depth)
    case 'cylinder':
      return new THREE.CylinderGeometry(vessel.radius, vessel.radius, h, radialSegments)
    case 'cone': {
      const rBottom = vessel.radius * vessel.taper
      const rTop = radiusAtHeight(vessel, h)
      return new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments)
    }
  }
}

/**
 * Quantise a height so geometry is only rebuilt when the change is visible.
 * 96 steps across the vessel is well under one pixel of movement per rebuild
 * at normal zoom, but bounds rebuilds to ~96 per drain instead of ~3 000.
 */
export function quantiseHeight(height: number, vesselHeight: number, steps = 96): number {
  const q = vesselHeight / steps
  return Math.round(height / q) * q
}
