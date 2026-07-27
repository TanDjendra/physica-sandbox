/**
 * MathOverlay — live LaTeX that tracks the simulation.
 *
 * Each card carries the symbolic law, the same law with the current parameter
 * values substituted, and a one-line reading of what it means right now. The
 * substitution is what makes this a teaching tool rather than a formula sheet:
 * the numbers on screen are the numbers the integrator is actually using.
 */

import { useMemo } from 'react'
import { Tex } from './Tex'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useT } from '../../i18n'
import {
  analyticEmptyTime,
  hasConstantCrossSection,
  crossSectionArea,
  orificeArea,
} from '../../physics/fluidEngine'
import { computeCalculusTelemetry, classifyCriticalPoint } from '../../physics/calculusEngine'
import { sig, fixed, duration } from '../../utils/format'
import type { FluidState } from '../../types'

interface Card {
  title: string
  tex: string
  note?: string
  tone?: 'accent' | 'flux' | 'solve'
}

function CardList({ cards }: { cards: Card[] }) {
  const bar = {
    accent: 'border-l-sky-400/60',
    flux: 'border-l-pink-400/60',
    solve: 'border-l-violet-400/60',
  }
  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-lg border border-white/5 border-l-2 bg-white/[0.02] px-3 py-2 ${
            bar[card.tone ?? 'accent']
          }`}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {card.title}
          </div>
          <Tex display>{card.tex}</Tex>
          {card.note && <div className="mt-1 text-[10.5px] leading-snug text-slate-500">{card.note}</div>}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Hydrodynamics
 * ------------------------------------------------------------------ */

function HydroMath() {
  const vessel = useSimStore((s) => s.vessel)
  const orifice = useSimStore((s) => s.orifice)
  const env = useSimStore((s) => s.environment)
  const hydro = useTelemetryStore((s) => s.hydro)
  const t = useT()

  const cards = useMemo<Card[]>(() => {
    const { dischargeCoefficient: cd, holeRadius: r, holeHeight: y } = orifice
    const g = env.gravity
    const rho = env.fluidDensity
    const h = hydro.waterHeight
    const H = hydro.head
    const a = orificeArea(orifice)
    const A = crossSectionArea(vessel, h)

    const state: FluidState = { vessel, orifice, environment: env, waterHeight: h }
    const te = analyticEmptyTime(state, h)
    const constantA = hasConstantCrossSection(vessel)

    const re = hydro.reynolds
    const regimeKey = re < 2300 ? 'regime.laminar' : re < 4000 ? 'regime.transitional' : 'regime.turbulent'

    const list: Card[] = [
      {
        title: t('eq.torricelli.title'),
        tex: `v = C_d\\sqrt{2gH} = ${sig(cd)}\\sqrt{2(${sig(g)})(${sig(H)})} = ${sig(
          hydro.exitVelocity,
        )}\\;\\mathrm{m\\,s^{-1}}`,
        note: t('eq.torricelli.note', { v: fixed(Math.sqrt(2 * g * H), 3) }),
      },
      {
        title: t('eq.bernoulli.title'),
        tex: `P_0+\\rho g h+\\tfrac12\\rho v_1^{2}\\;=\\;P_0+\\rho g y+\\tfrac12\\rho v_2^{2},\\quad v_1\\approx 0`,
        note: t('eq.bernoulli.note'),
        tone: 'flux',
      },
      {
        title: t('eq.pressure.title'),
        tex: `P = \\rho g H = (${sig(rho)})(${sig(g)})(${sig(H)}) = ${sig(
          hydro.pressureAtOrifice,
        )}\\;\\mathrm{Pa}`,
        note: t('eq.pressure.note', { p: sig(hydro.pressureAtFloor) }),
        tone: 'flux',
      },
      {
        title: t('eq.discharge.title'),
        tex: `Q = C_d\\,a\\sqrt{2gH} = ${sig(hydro.flowRate)}\\;\\mathrm{m^3s^{-1}},\\quad a=\\pi r^{2}=${sig(
          a,
        )}\\;\\mathrm{m^2}`,
        note: t('eq.discharge.note', {
          m: sig(rho * hydro.flowRate),
          f: sig(rho * hydro.flowRate * hydro.exitVelocity),
        }),
      },
      {
        title: t('eq.ode.title'),
        tex: `A(h)\\,\\frac{dh}{dt} = -\\,C_d\\,a\\,\\sqrt{2g\\,(h-y)},\\qquad A = ${sig(A)}\\;\\mathrm{m^2}`,
        note: constantA ? t('eq.ode.noteConstant') : t('eq.ode.noteVariable'),
        tone: 'solve',
      },
      {
        title: constantA ? t('eq.solution.titleClosed') : t('eq.solution.titleReference'),
        tex: constantA
          ? `h(t) = y+\\left(\\sqrt{H_0}-\\frac{C_d a\\sqrt{2g}}{2A}\\,t\\right)^{2},\\quad t_e=\\frac{A}{C_d a}\\sqrt{\\frac{2H_0}{g}}`
          : `h(t)\\;\\text{from}\\;\\mathrm{RK4}\\left[\\frac{dh}{dt}=-\\frac{C_d a\\sqrt{2g(h-y)}}{A(h)}\\right],\\ \\Delta t=\\tfrac{1}{240}\\,\\mathrm{s}`,
        note: t('eq.solution.note', { t: duration(te) }),
        tone: 'solve',
      },
      {
        title: t('eq.range.title'),
        tex: `R = v\\sqrt{\\tfrac{2y}{g}} = 2C_d\\sqrt{y\\,(h-y)} = ${sig(hydro.jetRange)}\\;\\mathrm{m}`,
        note: t('eq.range.note', {
          yh: fixed(h / 2, 3),
          rmax: fixed(cd * h, 3),
          y: fixed(y, 3),
        }),
      },
      {
        title: t('eq.reynolds.title'),
        tex: `\\mathrm{Re}=\\frac{\\rho v D}{\\mu}=\\frac{(${sig(rho)})(${sig(
          hydro.exitVelocity,
        )})(${sig(2 * r)})}{${sig(env.viscosity)}}=${sig(re)}`,
        note: t('eq.reynolds.note', { regime: t(regimeKey) }),
        tone: 'flux',
      },
    ]
    return list
  }, [vessel, orifice, env, hydro, t])

  return <CardList cards={cards} />
}

/* ------------------------------------------------------------------ *
 * Calculus
 * ------------------------------------------------------------------ */

function CalculusMath() {
  const calculus = useSimStore((s) => s.calculus)
  const t = useT()

  const cards = useMemo<Card[]>(() => {
    const { sheetWidth: W, sheetLength: L, cut: x } = calculus
    const cal = computeCalculusTelemetry(calculus)
    const o = cal.optimum
    const natureKey = `nature.${classifyCriticalPoint(o.secondDerivative)}` as const

    const currentNote =
      Math.abs(cal.firstDerivative) < 1e-6
        ? t('eq.current.noteZero')
        : cal.firstDerivative > 0
          ? t('eq.current.notePos')
          : t('eq.current.noteNeg')

    return [
      {
        title: t('eq.volume.title'),
        tex: `V(x) = (W-2x)(L-2x)\\,x = (${sig(W)}-2x)(${sig(L)}-2x)x`,
        note: t('eq.volume.note', { d: fixed(o.domainMax, 3) }),
      },
      {
        title: t('eq.cubic.title'),
        tex: `V(x) = 4x^{3}-2(W+L)x^{2}+WLx = 4x^{3}-${sig(2 * (W + L))}x^{2}+${sig(W * L)}x`,
      },
      {
        title: t('eq.current.title'),
        tex: `V(${sig(x)}) = ${sig(cal.volume)},\\qquad V'(${sig(x)}) = ${sig(cal.firstDerivative)}`,
        note: currentNote,
        tone: 'flux',
      },
      {
        title: t('eq.stationary.title'),
        tex: `V'(x)=12x^{2}-4(W+L)x+WL=0\\;\\Longrightarrow\\;x=\\frac{(W+L)\\pm\\sqrt{W^{2}-WL+L^{2}}}{6}`,
        note: t('eq.stationary.note', {
          x1: fixed(o.xOptimal, 4),
          x2: fixed(o.xRejected, 4),
          d: fixed(o.domainMax, 4),
        }),
        tone: 'solve',
      },
      {
        title: t('eq.secondDeriv.title'),
        tex: `V''(x^{*}) = 24x^{*}-4(W+L) = ${sig(o.secondDerivative)} \\;${
          o.secondDerivative < 0 ? '<' : '>'
        }\\; 0`,
        note: t('eq.secondDeriv.note', { nature: t(natureKey) }),
        tone: 'solve',
      },
      {
        title: t('eq.optimum.title'),
        tex: `x^{*} = ${sig(o.xOptimal, 6)},\\qquad V_{\\max} = V(x^{*}) = ${sig(o.volumeMax, 6)}`,
        note: t('eq.optimum.note', { pct: (cal.efficiency * 100).toFixed(2) }),
      },
      {
        title: t('eq.crosscheck.title'),
        tex: `\\left|x^{*}_{\\text{closed}}-x^{*}_{\\text{numeric}}\\right| = ${sig(o.residual, 3)}`,
        note: t('eq.crosscheck.note'),
        tone: 'flux',
      },
      {
        title: t('eq.areas.title'),
        tex: `A_{\\text{base}} = (W-2x)(L-2x) = ${sig(cal.baseArea)},\\quad A_{\\text{sheet}} = WL-4x^{2} = ${sig(
          cal.surfaceArea,
        )}`,
      },
    ]
  }, [calculus, t])

  return <CardList cards={cards} />
}

export function MathOverlay() {
  const module = useSimStore((s) => s.module)
  return module === 'hydrodynamics' ? <HydroMath /> : <CalculusMath />
}
