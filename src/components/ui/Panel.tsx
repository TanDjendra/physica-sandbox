/** Small presentational primitives shared by every side-panel section. */

import type { ReactNode } from 'react'

export function Section({
  title,
  accent,
  right,
  children,
  className = '',
}: {
  title: string
  accent?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel rounded-xl ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: accent ?? '#38bdf8', boxShadow: `0 0 8px ${accent ?? '#38bdf8'}` }}
          />
          <h2 className="panel-title">{title}</h2>
        </div>
        {right}
      </header>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  tone = 'default',
  hint,
}: {
  label: string
  value: string
  unit?: string
  tone?: 'default' | 'accent' | 'warn' | 'good' | 'muted'
  hint?: string
}) {
  const toneClass = {
    default: 'text-slate-100',
    accent: 'text-sky-300',
    warn: 'text-amber-300',
    good: 'text-emerald-300',
    muted: 'text-slate-400',
  }[tone]

  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={hint}>
      <span className="truncate text-[11px] text-slate-400">{label}</span>
      <span className={`tabular font-mono text-[12px] ${toneClass}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span>}
      </span>
    </div>
  )
}

export function Meter({
  value,
  color = '#38bdf8',
  label,
}: {
  value: number
  color?: string
  label?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="py-1">
      {label && (
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>{label}</span>
          <span className="tabular font-mono">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}80` }}
        />
      </div>
    </div>
  )
}

export function Divider() {
  return <div className="my-2 h-px w-full bg-white/5" />
}
