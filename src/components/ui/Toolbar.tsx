/** Toolbar — module switch, transport controls and camera presets. */

import type { ReactNode } from 'react'
import { useSimStore } from '../../state/simulationStore'
import { useTelemetryStore } from '../../state/telemetryStore'
import { useT } from '../../i18n'
import type { StringKey } from '../../i18n/strings'
import type { CameraPreset, SimulationModule } from '../../types'
import { fixed } from '../../utils/format'

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const

const MODULES: Array<{ id: SimulationModule; label: StringKey; sub: StringKey }> = [
  { id: 'hydrodynamics', label: 'mod.hydro', sub: 'mod.hydroSub' },
  { id: 'calculus', label: 'mod.calc', sub: 'mod.calcSub' },
]

function Btn({
  active,
  onClick,
  title,
  children,
  className = '',
}: {
  active?: boolean
  onClick: () => void
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-400/40'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function IconPlay() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.4v9.2L10 6z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2.2" y="1.5" width="2.9" height="9" rx="0.6" />
      <rect x="6.9" y="1.5" width="2.9" height="9" rx="0.6" />
    </svg>
  )
}

function IconStep() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2 1.4v9.2L8.4 6z" />
      <rect x="9" y="1.4" width="1.8" height="9.2" rx="0.6" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M12 7a5 5 0 1 1-1.6-3.7" strokeLinecap="round" />
      <path d="M12.4 1.6V4.4H9.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Toolbar() {
  const module = useSimStore((s) => s.module)
  const setModule = useSimStore((s) => s.setModule)
  const clock = useSimStore((s) => s.clock)
  const toggleRunning = useSimStore((s) => s.toggleRunning)
  const setTimeScale = useSimStore((s) => s.setTimeScale)
  const requestStep = useSimStore((s) => s.requestStep)
  const reset = useSimStore((s) => s.reset)
  const preset = useSimStore((s) => s.view.preset)
  const setView = useSimStore((s) => s.setView)
  const locale = useSimStore((s) => s.locale)
  const toggleLocale = useSimStore((s) => s.toggleLocale)
  const fps = useTelemetryStore((s) => s.perf.fps)
  const t = useT()

  const presets: Array<{ id: CameraPreset; label: string }> = [
    { id: 'isometric', label: t('preset.iso') },
    { id: 'front', label: module === 'hydrodynamics' ? t('preset.crossSection') : t('preset.front') },
    { id: 'top', label: t('preset.top') },
    { id: 'orifice', label: module === 'hydrodynamics' ? t('preset.orifice') : t('preset.corner') },
  ]

  return (
    <header className="panel z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2">
      {/* brand */}
      <div className="flex items-center gap-2.5 pr-1">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset ring-sky-400/30"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.3), rgba(139,92,246,0.3))',
          }}
        >
          <span className="text-[13px] font-semibold text-sky-200">∮</span>
        </div>
        <div className="leading-tight">
          <div className="text-[12.5px] font-semibold tracking-tight text-slate-100">
            Physica Sandbox
          </div>
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
            {t('app.subtitle')}
          </div>
        </div>
      </div>

      {/* module tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-black/25 p-1">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModule(m.id)}
            className={`rounded-md px-3 py-1 text-left transition-colors ${
              module === m.id
                ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400/40'
                : 'hover:bg-white/5'
            }`}
          >
            <div
              className={`text-[11.5px] font-medium ${
                module === m.id ? 'text-sky-100' : 'text-slate-300'
              }`}
            >
              {t(m.label)}
            </div>
            <div className="font-mono text-[9px] text-slate-500">{t(m.sub)}</div>
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* transport */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleRunning}
          title={clock.running ? t('tip.pause') : t('tip.play')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
            clock.running
              ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30'
              : 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40'
          }`}
        >
          {clock.running ? <IconPause /> : <IconPlay />}
          {clock.running ? t('transport.running') : t('transport.paused')}
        </button>
        <Btn onClick={requestStep} title={t('tip.step')}>
          <span className="flex items-center gap-1.5">
            <IconStep /> {t('transport.step')}
          </span>
        </Btn>
        <Btn onClick={reset} title={t('tip.reset')}>
          <span className="flex items-center gap-1.5">
            <IconReset /> {t('transport.reset')}
          </span>
        </Btn>
      </div>

      {/* speed */}
      <div className="flex items-center gap-1 rounded-lg bg-black/25 p-1">
        {SPEEDS.map((s) => (
          <Btn key={s} active={clock.timeScale === s} onClick={() => setTimeScale(s)}>
            {s}×
          </Btn>
        ))}
      </div>

      {/* camera */}
      <div className="flex items-center gap-1 rounded-lg bg-black/25 p-1">
        <span className="px-1.5 text-[9px] uppercase tracking-[0.14em] text-slate-500">
          {t('cam.label')}
        </span>
        {presets.map((p) => (
          <Btn
            key={p.id}
            active={preset === p.id}
            onClick={() => setView({ preset: p.id })}
            title={t('tip.camPreset', { label: p.label })}
          >
            {p.label}
          </Btn>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* language toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          title={t('tip.language')}
          className="flex items-center gap-1 rounded-lg bg-black/25 p-1 text-[10px] font-semibold"
        >
          {(['en', 'id'] as const).map((code) => (
            <span
              key={code}
              className={`rounded-md px-1.5 py-0.5 uppercase tracking-wide transition-colors ${
                locale === code ? 'bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-400/40' : 'text-slate-500'
              }`}
            >
              {code}
            </span>
          ))}
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/25 px-2.5 py-1">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="tabular font-mono text-[11px] text-slate-300">
            {fixed(fps, 0)} {t('unit.fps')}
          </span>
        </div>
      </div>
    </header>
  )
}
