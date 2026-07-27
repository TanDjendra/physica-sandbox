/**
 * ControlPanel — Leva bindings for every simulation parameter.
 *
 * Two-way sync strategy: Leva owns the widget state and pushes changes into the
 * store through `onChange` (which Leva treats as *transient*, so dragging a
 * slider never re-renders React). When the store is mutated from the outside —
 * a gravity preset, "snap to optimum", "restore defaults", or a language
 * change — it bumps `syncToken`, and the headless control components are
 * remounted with fresh initial values (and freshly-translated labels). That is
 * deliberately simpler and more robust than driving Leva's imperative `set`.
 *
 * Labels come from `tp()` (the non-hook translator) because Leva builds its
 * schema imperatively at render time, outside React's hook rules. Widget
 * *keys* (`height`, `shape`, …) stay English identifiers so Leva keeps each
 * control's identity stable within a locale; only the displayed `label` and
 * the button/folder labels are translated.
 */

import { Leva, useControls, button, buttonGroup, folder } from 'leva'
import { useSimStore } from '../../state/simulationStore'
import { useT, tp } from '../../i18n'
import { optimiseBox } from '../../physics/calculusEngine'
import { DISCHARGE_HINTS, FLUIDS, GRAVITY } from '../../physics/constants'
import type { StringKey } from '../../i18n/strings'

const levaTheme = {
  colors: {
    elevation1: 'transparent',
    elevation2: 'rgba(10,15,28,0.6)',
    elevation3: 'rgba(30,41,59,0.85)',
    accent1: '#0ea5e9',
    accent2: '#38bdf8',
    accent3: '#7dd3fc',
    highlight1: '#64748b',
    highlight2: '#cbd5e1',
    highlight3: '#f1f5f9',
    vivid1: '#f472b6',
    folderWidgetColor: '#7dd3fc',
    folderTextColor: '#bae6fd',
    toolTipBackground: '#0f172a',
    toolTipText: '#e2e8f0',
  },
  sizes: { rootWidth: '100%', controlWidth: '52%', scrubberWidth: '8px', rowHeight: '22px' },
  fontSizes: { root: '11px' },
  space: { sm: '6px', md: '9px', rowGap: '6px', colGap: '6px' },
  radii: { xs: '3px', sm: '5px', lg: '9px' },
  fonts: { mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
}

/* ------------------------------------------------------------------ *
 * Hydrodynamics controls
 * ------------------------------------------------------------------ */

function HydroControls() {
  const s = useSimStore.getState()
  const { vessel, orifice, environment, particles, view } = s

  useControls(tp('folder.vessel'), () => ({
    shape: {
      value: vessel.shape,
      label: tp('ctl.shape'),
      options: {
        [tp('shape.cylinder')]: 'cylinder',
        [tp('shape.box')]: 'box',
        [tp('shape.cone')]: 'cone',
      },
      onChange: (v: typeof vessel.shape) => useSimStore.getState().setVessel({ shape: v }),
    },
    height: {
      value: vessel.height,
      min: 0.4,
      max: 4,
      step: 0.05,
      label: tp('ctl.height'),
      onChange: (v: number) => useSimStore.getState().setVessel({ height: v }),
    },
    radius: {
      value: vessel.radius,
      min: 0.1,
      max: 1.6,
      step: 0.01,
      label: tp('ctl.radius'),
      onChange: (v: number) => useSimStore.getState().setVessel({ radius: v }),
    },
    taper: {
      value: vessel.taper,
      min: 0.05,
      max: 1,
      step: 0.01,
      label: tp('ctl.taper'),
      hint: tp('ctl.taperHint'),
      onChange: (v: number) => useSimStore.getState().setVessel({ taper: v }),
    },
    width: {
      value: vessel.width,
      min: 0.2,
      max: 3,
      step: 0.02,
      label: tp('ctl.width'),
      onChange: (v: number) => useSimStore.getState().setVessel({ width: v }),
    },
    depth: {
      value: vessel.depth,
      min: 0.2,
      max: 3,
      step: 0.02,
      label: tp('ctl.depth'),
      onChange: (v: number) => useSimStore.getState().setVessel({ depth: v }),
    },
    initialFill: {
      value: vessel.initialFill,
      min: 0.05,
      max: 4,
      step: 0.01,
      label: tp('ctl.fill'),
      onChange: (v: number) => useSimStore.getState().setVessel({ initialFill: v }),
    },
  }))

  useControls(tp('folder.orifice'), () => ({
    holeHeight: {
      value: orifice.holeHeight,
      min: 0,
      max: 3.8,
      step: 0.01,
      label: tp('ctl.holeHeight'),
      onChange: (v: number) => useSimStore.getState().setOrifice({ holeHeight: v }),
    },
    holeRadius: {
      value: orifice.holeRadius,
      min: 0.004,
      max: 0.2,
      step: 0.002,
      label: tp('ctl.holeRadius'),
      onChange: (v: number) => useSimStore.getState().setOrifice({ holeRadius: v }),
    },
    dischargeCoefficient: {
      value: orifice.dischargeCoefficient,
      min: 0.1,
      max: 1,
      step: 0.01,
      label: tp('ctl.cd'),
      onChange: (v: number) => useSimStore.getState().setOrifice({ dischargeCoefficient: v }),
    },
    [tp('ctl.cdPresets')]: buttonGroup(
      Object.fromEntries(
        DISCHARGE_HINTS.map((h) => [
          h.value.toFixed(2),
          () => useSimStore.getState().setOrifice({ dischargeCoefficient: h.value }),
        ]),
      ),
    ),
    [tp('ctl.maxRange')]: button(() => {
      const st = useSimStore.getState()
      st.setOrifice({ holeHeight: st.vessel.initialFill / 2 })
    }),
  }))

  useControls(tp('folder.environment'), () => ({
    gravity: {
      value: environment.gravity,
      min: 0,
      max: 30,
      step: 0.01,
      label: tp('ctl.gravity'),
      onChange: (v: number) => useSimStore.getState().setEnvironment({ gravity: v }),
    },
    [tp('ctl.bodies')]: buttonGroup({
      [tp('gbtn.earth')]: () => useSimStore.getState().applyGravity('earth'),
      [tp('gbtn.moon')]: () => useSimStore.getState().applyGravity('moon'),
      [tp('gbtn.mars')]: () => useSimStore.getState().applyGravity('mars'),
      [tp('gbtn.zero')]: () => useSimStore.getState().applyGravity('zero'),
    }),
    fluidDensity: {
      value: environment.fluidDensity,
      min: 100,
      max: 14000,
      step: 1,
      label: tp('ctl.density'),
      onChange: (v: number) => useSimStore.getState().setEnvironment({ fluidDensity: v }),
    },
    viscosity: {
      value: environment.viscosity,
      min: 1e-4,
      max: 2,
      step: 1e-4,
      label: tp('ctl.viscosity'),
      onChange: (v: number) => useSimStore.getState().setEnvironment({ viscosity: v }),
    },
    [tp('ctl.fluids')]: buttonGroup(
      Object.fromEntries(
        (Object.keys(FLUIDS) as (keyof typeof FLUIDS)[]).map((k) => [
          tp(`fluid.${k}` as StringKey),
          () => useSimStore.getState().applyFluid(k),
        ]),
      ),
    ),
    airDrag: {
      value: environment.airDrag,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: tp('ctl.airDrag'),
      hint: tp('ctl.airDragHint'),
      onChange: (v: number) => useSimStore.getState().setEnvironment({ airDrag: v }),
    },
    refill: {
      value: environment.refill,
      label: tp('ctl.refill'),
      hint: tp('ctl.refillHint'),
      onChange: (v: boolean) => useSimStore.getState().setEnvironment({ refill: v }),
    },
  }))

  useControls(tp('folder.particles'), () => ({
    emissionRate: {
      value: particles.emissionRate,
      min: 100,
      max: 12000,
      step: 50,
      label: tp('ctl.rate'),
      onChange: (v: number) => useSimStore.getState().setParticles({ emissionRate: v }),
    },
    particleRadius: {
      value: particles.particleRadius,
      min: 0.002,
      max: 0.05,
      step: 0.001,
      label: tp('ctl.parcelRadius'),
      onChange: (v: number) => useSimStore.getState().setParticles({ particleRadius: v }),
    },
    lifetime: {
      value: particles.lifetime,
      min: 0.2,
      max: 6,
      step: 0.1,
      label: tp('ctl.lifetime'),
      onChange: (v: number) => useSimStore.getState().setParticles({ lifetime: v }),
    },
    maxParticles: {
      value: particles.maxParticles,
      min: 500,
      max: 20000,
      step: 500,
      label: tp('ctl.maxLive'),
      onChange: (v: number) => useSimStore.getState().setParticles({ maxParticles: v }),
    },
    spread: {
      value: particles.spread,
      min: 0,
      max: 0.35,
      step: 0.005,
      label: tp('ctl.spread'),
      onChange: (v: number) => useSimStore.getState().setParticles({ spread: v }),
    },
    speedJitter: {
      value: particles.speedJitter,
      min: 0,
      max: 0.4,
      step: 0.01,
      label: tp('ctl.jitter'),
      onChange: (v: number) => useSimStore.getState().setParticles({ speedJitter: v }),
    },
  }))

  useControls(tp('folder.display'), () => ({
    [tp('folder.overlays')]: folder({
      showPressureField: {
        value: view.showPressureField,
        label: tp('ctl.pressureField'),
        onChange: (v: boolean) => useSimStore.getState().setView({ showPressureField: v }),
      },
      showVelocityVector: {
        value: view.showVelocityVector,
        label: tp('ctl.velocityHead'),
        onChange: (v: boolean) => useSimStore.getState().setView({ showVelocityVector: v }),
      },
      showTrajectory: {
        value: view.showTrajectory,
        label: tp('ctl.trajectory'),
        onChange: (v: boolean) => useSimStore.getState().setView({ showTrajectory: v }),
      },
      showLabels: {
        value: view.showLabels,
        label: tp('ctl.labels'),
        onChange: (v: boolean) => useSimStore.getState().setView({ showLabels: v }),
      },
    }),
    [tp('folder.scene')]: folder({
      crossSection: {
        value: view.crossSection,
        label: tp('ctl.crossSection'),
        onChange: (v: boolean) => useSimStore.getState().setView({ crossSection: v }),
      },
      showGrid: {
        value: view.showGrid,
        label: tp('ctl.grid'),
        onChange: (v: boolean) => useSimStore.getState().setView({ showGrid: v }),
      },
      shadows: {
        value: view.shadows,
        label: tp('ctl.shadows'),
        onChange: (v: boolean) => useSimStore.getState().setView({ shadows: v }),
      },
      autoRotate: {
        value: view.autoRotate,
        label: tp('ctl.autoRotate'),
        onChange: (v: boolean) => useSimStore.getState().setView({ autoRotate: v }),
      },
    }),
    [tp('ctl.restoreDefaults')]: button(() => useSimStore.getState().restoreDefaults()),
  }))

  return null
}

/* ------------------------------------------------------------------ *
 * Calculus controls
 * ------------------------------------------------------------------ */

function CalculusControls() {
  const { calculus, view } = useSimStore.getState()
  const maxCut = Math.min(calculus.sheetWidth, calculus.sheetLength) / 2

  useControls(tp('folder.sheet'), () => ({
    sheetWidth: {
      value: calculus.sheetWidth,
      min: 1,
      max: 40,
      step: 0.1,
      label: tp('ctl.sheetWidth'),
      onChange: (v: number) => useSimStore.getState().setCalculus({ sheetWidth: v }),
    },
    sheetLength: {
      value: calculus.sheetLength,
      min: 1,
      max: 40,
      step: 0.1,
      label: tp('ctl.sheetLength'),
      onChange: (v: number) => useSimStore.getState().setCalculus({ sheetLength: v }),
    },
    cut: {
      value: calculus.cut,
      min: 0.01,
      max: Math.max(maxCut - 0.01, 0.02),
      step: 0.001,
      label: tp('ctl.cut'),
      onChange: (v: number) => useSimStore.getState().setCalculus({ cut: v }),
    },
    [tp('ctl.snapOptimum')]: button(() => {
      const st = useSimStore.getState()
      const { xOptimal } = optimiseBox(st.calculus.sheetWidth, st.calculus.sheetLength)
      st.snapCutToOptimum(xOptimal)
    }),
    [tp('ctl.squareSheet')]: button(() => {
      const st = useSimStore.getState()
      st.setCalculus({ sheetLength: st.calculus.sheetWidth })
      useSimStore.setState((p) => ({ syncToken: p.syncToken + 1 }))
    }),
  }))

  useControls(tp('folder.fold'), () => ({
    foldProgress: {
      value: calculus.foldProgress,
      min: 0,
      max: 1,
      step: 0.001,
      label: tp('ctl.foldProgress'),
      onChange: (v: number) => useSimStore.getState().setCalculus({ foldProgress: v }),
    },
    autoFold: {
      value: calculus.autoFold,
      label: tp('ctl.autoFold'),
      onChange: (v: boolean) => useSimStore.getState().setCalculus({ autoFold: v }),
    },
    showOptimum: {
      value: calculus.showOptimum,
      label: tp('ctl.ghostOptimum'),
      onChange: (v: boolean) => useSimStore.getState().setCalculus({ showOptimum: v }),
    },
  }))

  useControls(tp('folder.display'), () => ({
    showLabels: {
      value: view.showLabels,
      label: tp('ctl.labels'),
      onChange: (v: boolean) => useSimStore.getState().setView({ showLabels: v }),
    },
    showGrid: {
      value: view.showGrid,
      label: tp('ctl.grid'),
      onChange: (v: boolean) => useSimStore.getState().setView({ showGrid: v }),
    },
    shadows: {
      value: view.shadows,
      label: tp('ctl.shadows'),
      onChange: (v: boolean) => useSimStore.getState().setView({ shadows: v }),
    },
    autoRotate: {
      value: view.autoRotate,
      label: tp('ctl.autoRotate'),
      onChange: (v: boolean) => useSimStore.getState().setView({ autoRotate: v }),
    },
    [tp('ctl.restoreDefaults')]: button(() => useSimStore.getState().restoreDefaults()),
  }))

  return null
}

/* ------------------------------------------------------------------ *
 * Public panel
 * ------------------------------------------------------------------ */

export function ControlPanel() {
  const module = useSimStore((s) => s.module)
  const syncToken = useSimStore((s) => s.syncToken)
  const gravity = useSimStore((s) => s.environment.gravity)
  const t = useT()

  const bodyId = Object.entries(GRAVITY).find(([, g]) => Math.abs(g - gravity) < 1e-3)?.[0]
  const bodyLabel = t(bodyId ? (`body.${bodyId}` as StringKey) : 'body.custom')

  return (
    <div className="flex flex-col">
      {/* The locale is folded into the remount key so a language switch
          rebuilds Leva with freshly-translated labels. */}
      {module === 'hydrodynamics' ? (
        <HydroControls key={`hydro-${syncToken}`} />
      ) : (
        <CalculusControls key={`calc-${syncToken}`} />
      )}

      <div id="leva-host" className="rounded-xl">
        <Leva fill flat titleBar={false} hideCopyButton theme={levaTheme} />
      </div>

      {module === 'hydrodynamics' && (
        <p className="px-1 pt-2 text-[10px] leading-relaxed text-slate-500">
          {t('ctl.footer', { body: bodyLabel })}
        </p>
      )}
    </div>
  )
}
