/**
 * AnalyticsGraph — live 2D plots that mirror the 3D scene.
 *
 * Hydrodynamics: the recorded water level against the pre-integrated
 * theoretical curve, plus efflux speed and discharge on a shared time axis.
 * Calculus: V(x) across the whole feasible domain with a marker locked to the
 * slider, the analytic optimum, and V′(x) on a second axis so the sign change
 * at x* is visible rather than asserted.
 *
 * Charts re-render on the 12 Hz telemetry cadence, never per frame, and every
 * animation is disabled — an animating chart lies about live data.
 */

import { useMemo, type ReactElement } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useT } from '../../i18n'
import {
  boxVolume,
  boxVolumeDerivative,
  optimiseBox,
  sampleFunction,
} from '../../physics/calculusEngine'
import { fixed } from '../../utils/format'

const AXIS = { stroke: '#475569', fontSize: 9, tickLine: false }
const GRID = { stroke: '#1e293b', strokeDasharray: '2 4' }

const tooltipStyle = {
  background: 'rgba(8,13,24,0.95)',
  border: '1px solid rgba(56,189,248,0.25)',
  borderRadius: 8,
  fontSize: 11,
  padding: '6px 8px',
  color: '#e2e8f0',
}

function ChartFrame({
  title,
  height = 158,
  children,
}: {
  title: string
  height?: number
  children: ReactElement
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Hydrodynamics
 * ------------------------------------------------------------------ */

function HydroCharts() {
  const series = useTelemetryStore((s) => s.series)
  const holeHeight = useSimStore((s) => s.orifice.holeHeight)
  const t = useT()

  const data = useMemo(
    () =>
      series.map((s) => ({
        t: Number(s.t.toFixed(2)),
        sim: Number(s.sim.toFixed(4)),
        theory: Number(s.theory.toFixed(4)),
        velocity: Number(s.velocity.toFixed(3)),
        flow: Number((s.flow * 1000).toFixed(3)),
      })),
    [series],
  )

  if (data.length < 2) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg border border-dashed border-white/10 px-3 text-center text-[11px] text-slate-500">
        {t('chart.empty')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartFrame title={t('chart.waterLevel')}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 2, left: -18 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" {...AXIS} unit="s" minTickGap={22} />
          <YAxis {...AXIS} width={44} domain={['auto', 'auto']} unit="m" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => `t = ${v} s`}
            formatter={(value, name) => [`${value} m`, name]}
          />
          <Legend
            verticalAlign="top"
            height={18}
            iconSize={8}
            wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}
          />
          <ReferenceLine
            y={holeHeight}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: t('ref.orifice'),
              fill: '#f59e0b',
              fontSize: 9,
              position: 'insideBottomRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="theory"
            name={t('legend.theory')}
            stroke="#a78bfa"
            strokeWidth={1.4}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="sim"
            name={t('legend.simulated')}
            stroke="#38bdf8"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartFrame>

      <ChartFrame title={t('chart.effluxDischarge')} height={132}>
        <LineChart data={data} margin={{ top: 4, right: -6, bottom: 2, left: -20 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" {...AXIS} unit="s" minTickGap={22} />
          <YAxis yAxisId="v" {...AXIS} width={40} />
          <YAxis yAxisId="q" orientation="right" {...AXIS} width={40} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `t = ${v} s`} />
          <Legend
            verticalAlign="top"
            height={18}
            iconSize={8}
            wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}
          />
          <Line
            yAxisId="v"
            type="monotone"
            dataKey="velocity"
            name={t('legend.v')}
            stroke="#34d399"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="q"
            type="monotone"
            dataKey="flow"
            name={t('legend.q')}
            stroke="#f472b6"
            strokeWidth={1.4}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartFrame>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Calculus
 * ------------------------------------------------------------------ */

function CalculusCharts() {
  const { sheetWidth: W, sheetLength: L, cut: x } = useSimStore((s) => s.calculus)
  const t = useT()

  const { data, optimum } = useMemo(() => {
    const opt = optimiseBox(W, L)
    const pts = sampleFunction((v) => boxVolume(W, L, v), 0, opt.domainMax, 180)
    return {
      optimum: opt,
      data: pts.map((p) => ({
        x: Number(p.x.toFixed(4)),
        V: Number(p.y.toFixed(5)),
        dV: Number(boxVolumeDerivative(W, L, p.x).toFixed(5)),
      })),
    }
  }, [W, L])

  const currentV = boxVolume(W, L, x)

  return (
    <div className="flex flex-col gap-4">
      <ChartFrame title={t('chart.vx')} height={176}>
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: -14 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, optimum.domainMax]}
            {...AXIS}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <YAxis {...AXIS} width={46} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => `x = ${Number(v).toFixed(3)}`}
            formatter={(value, name) => [Number(value).toFixed(4), name]}
          />
          <ReferenceLine
            x={optimum.xOptimal}
            stroke="#4ade80"
            strokeDasharray="4 4"
            label={{
              value: `x* = ${fixed(optimum.xOptimal, 3)}`,
              fill: '#4ade80',
              fontSize: 9,
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="V"
            name="V(x)"
            stroke="#38bdf8"
            strokeWidth={1.9}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={x}
            y={currentV}
            r={5}
            fill="#f472b6"
            stroke="#fff"
            strokeWidth={1.4}
            isFront
          />
        </LineChart>
      </ChartFrame>

      <ChartFrame title={t('chart.dvx')} height={132}>
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: -14 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, optimum.domainMax]}
            {...AXIS}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <YAxis {...AXIS} width={46} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => `x = ${Number(v).toFixed(3)}`}
          />
          <ReferenceLine y={0} stroke="#64748b" />
          <ReferenceLine x={optimum.xOptimal} stroke="#4ade80" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="dV"
            name="V′(x)"
            stroke="#a78bfa"
            strokeWidth={1.7}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={x}
            y={boxVolumeDerivative(W, L, x)}
            r={4.5}
            fill="#f472b6"
            stroke="#fff"
            strokeWidth={1.2}
            isFront
          />
        </LineChart>
      </ChartFrame>
    </div>
  )
}

export function AnalyticsGraph() {
  const module = useSimStore((s) => s.module)
  return module === 'hydrodynamics' ? <HydroCharts /> : <CalculusCharts />
}
