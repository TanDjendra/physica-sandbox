/**
 * App — layout, global keyboard transport and panel composition.
 *
 * Three columns: parameters on the left, the WebGL viewport in the middle,
 * live research read-outs on the right. Both side panels collapse so the
 * viewport can take the full width for demonstrations.
 */

import { useEffect, useState } from 'react'
import { Viewport } from './components/3d/Viewport'
import { Toolbar } from './components/ui/Toolbar'
import { ControlPanel } from './components/ui/ControlPanel'
import { MathOverlay } from './components/ui/MathOverlay'
import { AnalyticsGraph } from './components/ui/AnalyticsGraph'
import { PerformanceStats, SimulationStats } from './components/ui/StatsPanel'
import { Section } from './components/ui/Panel'
import { useSimStore } from './state/simulationStore'
import { useTelemetryStore } from './state/telemetryStore'
import { useT, type TFunction } from './i18n'
import { duration, fixed } from './utils/format'

function CollapseTab({
  side,
  collapsed,
  onToggle,
  t,
}: {
  side: 'left' | 'right'
  collapsed: boolean
  onToggle: () => void
  t: TFunction
}) {
  const glyph = side === 'left' ? (collapsed ? '›' : '‹') : collapsed ? '‹' : '›'
  const sideLabel = t(side === 'left' ? 'side.left' : 'side.right')
  return (
    <button
      type="button"
      onClick={onToggle}
      title={t(collapsed ? 'tip.panelShow' : 'tip.panelHide', { side: sideLabel })}
      className="grid h-14 w-4 place-items-center self-center rounded-md border border-white/5 bg-white/[0.03] text-[11px] text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
    >
      {glyph}
    </button>
  )
}

/** Floating read-out over the viewport: the three numbers that matter most. */
function ViewportHud() {
  const module = useSimStore((s) => s.module)
  const hydro = useTelemetryStore((s) => s.hydro)
  const elapsed = useTelemetryStore((s) => s.elapsed)
  const calculus = useSimStore((s) => s.calculus)
  const running = useSimStore((s) => s.clock.running)
  const timeScale = useSimStore((s) => s.clock.timeScale)
  const t = useT()

  const items =
    module === 'hydrodynamics'
      ? [
          { label: 't', value: duration(elapsed) },
          { label: 'h', value: `${fixed(hydro.waterHeight, 3)} m` },
          { label: 'v', value: `${fixed(hydro.exitVelocity, 2)} m/s` },
          { label: 'R', value: `${fixed(hydro.jetRange, 2)} m` },
        ]
      : [
          { label: 'x', value: fixed(calculus.cut, 3) },
          { label: 'W×L', value: `${fixed(calculus.sheetWidth, 1)}×${fixed(calculus.sheetLength, 1)}` },
          {
            label: 'V',
            value: fixed(
              Math.max(calculus.sheetWidth - 2 * calculus.cut, 0) *
                Math.max(calculus.sheetLength - 2 * calculus.cut, 0) *
                calculus.cut,
              3,
            ),
          },
        ]

  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
      <div className="panel flex items-center gap-3 rounded-lg px-3 py-1.5">
        {items.map((i) => (
          <div key={i.label} className="flex items-baseline gap-1.5">
            <span className="font-mono text-[10px] text-slate-500">{i.label}</span>
            <span className="tabular font-mono text-[12px] text-sky-200">{i.value}</span>
          </div>
        ))}
      </div>
      {!running && (
        <div className="panel w-fit rounded-lg px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-300">
          {t('hud.paused')}
        </div>
      )}
      {running && timeScale !== 1 && (
        <div className="panel w-fit rounded-lg px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-300">
          {t('hud.timeScale', { scale: timeScale })}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  const module = useSimStore((s) => s.module)
  const toggleRunning = useSimStore((s) => s.toggleRunning)
  const requestStep = useSimStore((s) => s.requestStep)
  const reset = useSimStore((s) => s.reset)
  const setModule = useSimStore((s) => s.setModule)
  const setView = useSimStore((s) => s.setView)
  const locale = useSimStore((s) => s.locale)
  const t = useT()

  // Keep the document language in sync for assistive tech and hyphenation.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          toggleRunning()
          break
        case 'ArrowRight':
          requestStep()
          break
        case 'r':
        case 'R':
          reset()
          break
        case '1':
          setModule('hydrodynamics')
          break
        case '2':
          setModule('calculus')
          break
        case 'i':
          setView({ preset: 'isometric' })
          break
        case 'f':
          setView({ preset: 'front' })
          break
        case 't':
          setView({ preset: 'top' })
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRunning, requestStep, reset, setModule, setView])

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <Toolbar />

      <div className="flex min-h-0 flex-1 gap-2">
        {/* ---------------- parameters ---------------- */}
        {leftOpen && (
          <aside className="thin-scroll flex w-[302px] shrink-0 flex-col gap-2 overflow-y-auto pr-0.5">
            <Section title={t('sec.parameters')} accent="#38bdf8">
              <ControlPanel />
            </Section>

            <Section title={t('sec.shortcuts')} accent="#64748b">
              <ul className="space-y-1 text-[10.5px] text-slate-500">
                <li>
                  <kbd className="rounded bg-white/5 px-1 font-mono text-slate-300">Space</kbd>{' '}
                  {t('sc.playPause')}
                </li>
                <li>
                  <kbd className="rounded bg-white/5 px-1 font-mono text-slate-300">→</kbd>{' '}
                  {t('sc.step')}
                </li>
                <li>
                  <kbd className="rounded bg-white/5 px-1 font-mono text-slate-300">R</kbd>{' '}
                  {t('sc.restart')}
                </li>
                <li>
                  <kbd className="rounded bg-white/5 px-1 font-mono text-slate-300">1 / 2</kbd>{' '}
                  {t('sc.switchModule')}
                </li>
                <li>
                  <kbd className="rounded bg-white/5 px-1 font-mono text-slate-300">I / F / T</kbd>{' '}
                  {t('sc.camPresets')}
                </li>
                <li className="pt-1 text-slate-600">{t('sc.mouse')}</li>
              </ul>
            </Section>
          </aside>
        )}

        <CollapseTab side="left" collapsed={!leftOpen} onToggle={() => setLeftOpen((v) => !v)} t={t} />

        {/* ---------------- viewport ---------------- */}
        <main className="panel relative min-w-0 flex-1 overflow-hidden rounded-xl">
          <Viewport />
          <ViewportHud />
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-md">
            <p className="text-[10.5px] leading-relaxed text-slate-500">
              {module === 'hydrodynamics' ? t('caption.hydro') : t('caption.calc')}
            </p>
          </div>
        </main>

        <CollapseTab side="right" collapsed={!rightOpen} onToggle={() => setRightOpen((v) => !v)} t={t} />

        {/* ---------------- research read-outs ---------------- */}
        {rightOpen && (
          <aside className="thin-scroll flex w-[372px] shrink-0 flex-col gap-2 overflow-y-auto pl-0.5">
            <Section
              title={module === 'hydrodynamics' ? t('sec.liveState') : t('sec.optState')}
              accent="#38bdf8"
            >
              <SimulationStats />
            </Section>

            <Section title={t('sec.analytics')} accent="#f472b6">
              <AnalyticsGraph />
            </Section>

            <Section title={t('sec.equations')} accent="#a78bfa">
              <MathOverlay />
            </Section>

            <Section title={t('sec.diagnostics')} accent="#4ade80">
              <PerformanceStats />
            </Section>
          </aside>
        )}
      </div>
    </div>
  )
}
