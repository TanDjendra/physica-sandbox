/**
 * i18n — locale-aware string lookup.
 *
 * `translate` is a plain function so it can be called outside React (Leva
 * builds its control config imperatively). `useT` is the reactive wrapper the
 * components use; it re-derives whenever the locale changes.
 */

import { useMemo } from 'react'
import { en, id, type Locale, type StringKey } from './strings'
import { useSimStore } from '../state/simulationStore'

export type { Locale, StringKey } from './strings'

const DICT: Record<Locale, Record<StringKey, string>> = { en, id }

export type Vars = Record<string, string | number>

/** Look up `key` in `locale`, then substitute any `{name}` placeholders. */
export function translate(locale: Locale, key: StringKey, vars?: Vars): string {
  let out: string = DICT[locale][key] ?? en[key] ?? key
  if (vars) {
    for (const name of Object.keys(vars)) {
      out = out.split(`{${name}}`).join(String(vars[name]))
    }
  }
  return out
}

export type TFunction = (key: StringKey, vars?: Vars) => string

/** Reactive translator bound to the current locale. */
export function useT(): TFunction {
  const locale = useSimStore((s) => s.locale)
  return useMemo<TFunction>(() => (key, vars) => translate(locale, key, vars), [locale])
}

/** Non-reactive translator for imperative code (Leva). Reads current locale. */
export function tp(key: StringKey, vars?: Vars): string {
  return translate(useSimStore.getState().locale, key, vars)
}
