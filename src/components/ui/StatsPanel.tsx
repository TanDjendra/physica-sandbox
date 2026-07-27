/**
 * StatsPanel — live numeric read-outs.
 *
 * Left half is the physics state, right half is the renderer's own health.
 * Both come from the throttled telemetry store, so this panel commits twelve
 * times a second regardless of frame rate.
 */

import { Meter, Stat } from './Panel'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useT } from '../../i18n'
import { computeCalculusTelemetry } from '../../physics/calculusEngine'
import { compact, duration, fixed, flow, pressure, volume } from '../../utils/format'
import { vesselCapacity } from '../../physics/fluidEngine'

export function PerformanceStats() {
  const perf = useTelemetryStore((s) => s.perf)
  const maxParticles = useSimStore((s) => s.particles.maxParticles)
  const t = useT()

  const fpsTone = perf.fps >= 55 ? 'good' : perf.fps >= 30 ? 'warn' : 'muted'

  return (
    <div>
      <Stat label={t('stat.frameRate')} value={fixed(perf.fps, 1)} unit={t('unit.fps')} tone={fpsTone} />
      <Stat label={t('stat.frameTime')} value={fixed(perf.frameTime, 2)} unit="ms" />
      <Stat
        label={t('stat.liveParcels')}
        value={`${perf.particles.toLocaleString()} / ${maxParticles.toLocaleString()}`}
      />
      <Stat label={t('stat.drawCalls')} value={perf.drawCalls.toString()} tone="muted" />
      <Stat label={t('stat.triangles')} value={compact(perf.triangles, 1)} tone="muted" />
      <Stat label={t('stat.programs')} value={perf.programs.toString()} tone="muted" />
      <Meter
        value={maxParticles > 0 ? perf.particles / maxParticles : 0}
        color="#38bdf8"
        label={t('meter.parcelBudget')}
      />
    </div>
  )
}

function HydroStats() {
  const hydro = useTelemetryStore((s) => s.hydro)
  const elapsed = useTelemetryStore((s) => s.elapsed)
  const drained = useTelemetryStore((s) => s.drained)
  const vessel = useSimStore((s) => s.vessel)
  const t = useT()

  const capacity = vesselCapacity(vessel)

  return (
    <div>
      <Stat label={t('stat.simTime')} value={duration(elapsed)} tone="accent" />
      <Stat label={t('stat.waterLevel')} value={fixed(hydro.waterHeight, 4)} unit="m" />
      <Stat label={t('stat.head')} value={fixed(hydro.head, 4)} unit="m" tone="accent" />
      <Stat label={t('stat.exitVel')} value={fixed(hydro.exitVelocity, 3)} unit="m/s" tone="accent" />
      <Stat label={t('stat.discharge')} value={flow(hydro.flowRate)} />
      <Stat label={t('stat.liquidVol')} value={volume(hydro.volume)} />
      <Stat label={t('stat.pOrifice')} value={pressure(hydro.pressureAtOrifice)} />
      <Stat label={t('stat.pFloor')} value={pressure(hydro.pressureAtFloor)} />
      <Stat label={t('stat.jetRange')} value={fixed(hydro.jetRange, 3)} unit="m" />
      <Stat
        label={t('stat.reynolds')}
        value={compact(hydro.reynolds, 1)}
        tone={hydro.reynolds > 4000 ? 'warn' : 'good'}
        hint={t('stat.reynoldsHint')}
      />
      <Stat
        label={t('stat.timeToOrifice')}
        value={duration(hydro.timeToEmpty)}
        tone={drained ? 'muted' : 'default'}
      />
      <Meter value={hydro.drainedFraction} color="#f472b6" label={t('meter.drained')} />
      <Meter value={capacity > 0 ? hydro.volume / capacity : 0} color="#38bdf8" label={t('meter.capacity')} />
      {drained && (
        <p className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/5 px-2 py-1 text-[10.5px] text-amber-200">
          {t('warn.drained')}
        </p>
      )}
    </div>
  )
}

function CalculusStats() {
  const calculus = useSimStore((s) => s.calculus)
  const t = useT()
  const cal = computeCalculusTelemetry(calculus)
  const o = cal.optimum

  return (
    <div>
      <Stat label={t('stat.cut')} value={fixed(calculus.cut, 4)} tone="accent" />
      <Stat label={t('stat.volumeVx')} value={fixed(cal.volume, 4)} tone="accent" />
      <Stat
        label={t('stat.dVx')}
        value={fixed(cal.firstDerivative, 4)}
        tone={cal.firstDerivative > 0 ? 'good' : 'warn'}
      />
      <Stat label={t('stat.d2Vx')} value={fixed(cal.secondDerivative, 4)} />
      <Stat label={t('stat.baseArea')} value={fixed(cal.baseArea, 4)} />
      <Stat label={t('stat.sheetArea')} value={fixed(cal.surfaceArea, 4)} />
      <Stat label={t('stat.optimum')} value={fixed(o.xOptimal, 6)} tone="good" />
      <Stat label={t('stat.vAtOpt')} value={fixed(o.volumeMax, 6)} tone="good" />
      <Stat label={t('stat.rejectedRoot')} value={fixed(o.xRejected, 4)} tone="muted" />
      <Stat label={t('stat.domainMax')} value={fixed(o.domainMax, 4)} tone="muted" />
      <Stat
        label={t('stat.residual')}
        value={o.residual.toExponential(2)}
        tone="muted"
        hint={t('stat.residualHint')}
      />
      <Meter value={cal.efficiency} color="#4ade80" label={t('meter.volVsOpt')} />
    </div>
  )
}

export function SimulationStats() {
  const module = useSimStore((s) => s.module)
  return module === 'hydrodynamics' ? <HydroStats /> : <CalculusStats />
}
