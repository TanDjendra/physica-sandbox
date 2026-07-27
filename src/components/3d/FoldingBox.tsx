/**
 * FoldingBox — the calculus-optimisation scene.
 *
 * A W × L sheet has a square of side x removed from each corner; the four
 * flaps hinge up through π/2 to make an open box of volume
 * V(x) = (W − 2x)(L − 2x)·x.
 *
 * Implementation note: every panel is a *unit* BoxGeometry whose scale and
 * hinge transform are written imperatively in `useFrame`. Dragging the cut
 * slider therefore never rebuilds geometry — it only touches matrices — so the
 * mesh morphs at full frame rate no matter how fast the user scrubs.
 *
 * All of the hinge algebra lives in `physics/foldGeometry.ts`, which is pure
 * and unit-tested; this component only copies the resulting numbers onto
 * Object3Ds.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'
import { readSim, useSimStore } from '../../state/simulationStore'
import { runtime } from '../../state/runtime'
import { optimiseBox } from '../../physics/calculusEngine'
import { foldLayout, sheetOutline, type BoxTransform } from '../../physics/foldGeometry'
import { fixed } from '../../utils/format'

/** World-space span the sheet is fitted into, whatever W and L are. */
const FIT_SPAN = 4.6
/** Panel thickness as a fraction of the sheet's largest dimension. */
const THICKNESS_RATIO = 0.014

type MeshRef = THREE.Mesh | null
type GroupRef = THREE.Group | null

/** Copy a pure {position, scale} record onto an Object3D. */
function copyTransform(target: THREE.Object3D, t: BoxTransform) {
  target.position.set(t.position.x, t.position.y, t.position.z)
  target.scale.set(t.scale.x, t.scale.y, t.scale.z)
}

export function FoldingBox() {
  const calculus = useSimStore((s) => s.calculus)
  const showLabels = useSimStore((s) => s.view.showLabels)

  const root = useRef<THREE.Group>(null)
  const base = useRef<MeshRef>(null)
  const fill = useRef<MeshRef>(null)
  const ghost = useRef<MeshRef>(null)
  const hinges = useRef<GroupRef[]>([null, null, null, null])
  const flaps = useRef<MeshRef[]>([null, null, null, null])
  const corners = useRef<MeshRef[]>([null, null, null, null])

  const optimum = useMemo(
    () => optimiseBox(calculus.sheetWidth, calculus.sheetLength),
    [calculus.sheetWidth, calculus.sheetLength],
  )

  /** Dashed outline of the original uncut sheet. */
  const outline = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3))
    const material = new THREE.LineDashedMaterial({
      color: '#64748b',
      transparent: true,
      opacity: 0.75,
      dashSize: 0.28,
      gapSize: 0.2,
    })
    return new THREE.Line(geometry, material)
  }, [])

  useFrame((_, delta) => {
    const s = readSim()
    const { sheetWidth: W, sheetLength: L, cut: x, autoFold } = s.calculus

    /* --- fold parameter --- */
    if (autoFold && s.clock.running) {
      runtime.foldPhase += delta * 0.9 * s.clock.timeScale
    }
    const fold = autoFold
      ? 0.5 - 0.5 * Math.cos(runtime.foldPhase)
      : THREE.MathUtils.clamp(s.calculus.foldProgress, 0, 1)

    const layout = foldLayout(W, L, x, fold, THICKNESS_RATIO)

    /* --- fit the whole sheet into a fixed viewing span --- */
    if (root.current) root.current.scale.setScalar(FIT_SPAN / Math.max(W, L))

    /* --- base panel --- */
    if (base.current) {
      copyTransform(base.current, layout.base)
    }

    /* --- four hinged flaps --- */
    layout.flaps.forEach((flap, i) => {
      const hinge = hinges.current[i]
      const mesh = flaps.current[i]
      if (!hinge || !mesh) return
      hinge.position.set(flap.hinge.x, flap.hinge.y, flap.hinge.z)
      hinge.rotation.set(
        flap.axis === 'x' ? flap.rotation : 0,
        0,
        flap.axis === 'z' ? flap.rotation : 0,
      )
      mesh.position.set(flap.offset.x, flap.offset.y, flap.offset.z)
      mesh.scale.set(flap.scale.x, flap.scale.y, flap.scale.z)
    })

    /* --- discarded corner squares, fading out as the sheet folds --- */
    const cornerOpacity = (1 - fold) * 0.5
    corners.current.forEach((mesh, i) => {
      if (!mesh) return
      mesh.visible = cornerOpacity > 0.01
      copyTransform(mesh, layout.corners[i])
      const material = mesh.material as THREE.MeshStandardMaterial
      material.opacity = cornerOpacity
    })

    /* --- translucent volume body, filling exactly what the walls enclose --- */
    if (fill.current) {
      fill.current.visible = layout.cavityHeight > 1e-3
      copyTransform(fill.current, layout.fill)
    }

    /* --- ghost of the optimal box --- */
    if (ghost.current) {
      const xs = optimum.xOptimal
      const ideal = foldLayout(W, L, xs, fold, THICKNESS_RATIO)
      const visible =
        s.calculus.showOptimum && Math.abs(xs - x) > 1e-3 && ideal.cavityHeight > 1e-3
      ghost.current.visible = visible
      if (visible) copyTransform(ghost.current, ideal.fill)
    }

    /* --- uncut sheet outline --- */
    const attr = outline.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    sheetOutline(W, L).forEach((p, i) => {
      arr[i * 3] = p.x
      arr[i * 3 + 1] = p.y
      arr[i * 3 + 2] = p.z
    })
    attr.needsUpdate = true
    outline.computeLineDistances()
    outline.visible = fold < 0.995
  })

  return (
    <group ref={root}>
      <primitive object={outline} />

      {/* base */}
      <mesh ref={base} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#dbe4f0" roughness={0.72} metalness={0.04} />
      </mesh>

      {/* hinged flaps */}
      {[0, 1, 2, 3].map((i) => (
        <group
          key={i}
          ref={(el) => {
            hinges.current[i] = el
          }}
        >
          <mesh
            ref={(el) => {
              flaps.current[i] = el
            }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#b9c8dc" roughness={0.68} metalness={0.05} />
          </mesh>
        </group>
      ))}

      {/* removed corner squares */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            corners.current[i] = el
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#fb7185"
            transparent
            opacity={0.4}
            roughness={0.6}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* enclosed volume */}
      <mesh ref={fill}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transparent
          opacity={0.24}
          roughness={0.2}
          transmission={0.4}
          thickness={0.6}
          depthWrite={false}
        />
        <Edges color="#7dd3fc" />
      </mesh>

      {/* optimum reference */}
      <mesh ref={ghost}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
      </mesh>

      {showLabels && <FoldLabels optimumX={optimum.xOptimal} />}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Dimension annotations (DOM overlays, positioned in sheet units)
 * ------------------------------------------------------------------ */

function FoldLabels({ optimumX }: { optimumX: number }) {
  const { sheetWidth: W, sheetLength: L, cut: x } = useSimStore((s) => s.calculus)
  const a = Math.max(W - 2 * x, 0)
  const b = Math.max(L - 2 * x, 0)
  const volume = a * b * x

  const chip =
    'whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[11px] shadow-lg backdrop-blur'

  return (
    <group>
      <Html position={[0, 0, L / 2 + L * 0.07]} center distanceFactor={9}>
        <div className={`${chip} border-slate-400/25 bg-slate-950/80 text-slate-200`}>
          W = {fixed(W, 2)}
        </div>
      </Html>
      <Html position={[W / 2 + W * 0.08, 0, 0]} center distanceFactor={9}>
        <div className={`${chip} border-slate-400/25 bg-slate-950/80 text-slate-200`}>
          L = {fixed(L, 2)}
        </div>
      </Html>
      <Html position={[a / 2 + x / 2, x * 0.9 + 0.25, b / 2 + x / 2]} center distanceFactor={9}>
        <div className={`${chip} border-rose-400/30 bg-slate-950/80 text-rose-200`}>
          x = {fixed(x, 3)}
        </div>
      </Html>
      <Html position={[0, x + Math.max(W, L) * 0.12, 0]} center distanceFactor={9}>
        <div className={`${chip} border-sky-400/30 bg-slate-950/85 text-sky-200`}>
          V = {fixed(volume, 3)} · x* = {fixed(optimumX, 3)}
        </div>
      </Html>
    </group>
  )
}
