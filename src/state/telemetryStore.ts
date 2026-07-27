/**
 * telemetryStore — the read-only, throttled view of the simulation.
 *
 * The render loop writes here at ~12 Hz (see `PUBLISH_INTERVAL`), never per
 * frame. Panels, charts and the LaTeX overlay subscribe to it, so a 120 fps
 * viewport still only causes twelve React commits per second.
 */

import { create } from 'zustand'
import type { HydroTelemetry, PerformanceTelemetry, TimeSeriesSample } from '../types'

/** Seconds between publishes from the frame loop to React. */
export const PUBLISH_INTERVAL = 1 / 12

/** Maximum retained samples in the time-series recorder. */
export const MAX_SAMPLES = 360

const EMPTY_HYDRO: HydroTelemetry = {
  waterHeight: 0,
  head: 0,
  exitVelocity: 0,
  flowRate: 0,
  volume: 0,
  pressureAtOrifice: 0,
  pressureAtFloor: 0,
  jetRange: 0,
  reynolds: 0,
  timeToEmpty: 0,
  drainedFraction: 0,
}

const EMPTY_PERF: PerformanceTelemetry = {
  fps: 0,
  frameTime: 0,
  particles: 0,
  drawCalls: 0,
  triangles: 0,
  programs: 0,
}

export interface TelemetryState {
  hydro: HydroTelemetry
  perf: PerformanceTelemetry
  series: TimeSeriesSample[]
  elapsed: number
  /** True once the level has settled at the orifice. */
  drained: boolean

  publish: (hydro: HydroTelemetry, elapsed: number, drained: boolean) => void
  publishPerf: (perf: PerformanceTelemetry) => void
  pushSample: (sample: TimeSeriesSample) => void
  clearSeries: () => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  hydro: EMPTY_HYDRO,
  perf: EMPTY_PERF,
  series: [],
  elapsed: 0,
  drained: false,

  publish: (hydro, elapsed, drained) => set({ hydro, elapsed, drained }),
  publishPerf: (perf) => set({ perf }),

  pushSample: (sample) =>
    set((s) => {
      const series = s.series.length >= MAX_SAMPLES ? s.series.slice(1) : s.series.slice()
      series.push(sample)
      return { series }
    }),

  clearSeries: () => set({ series: [], elapsed: 0, drained: false }),
}))

export const readTelemetry = () => useTelemetryStore.getState()
