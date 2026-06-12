import type { CurrencyCode } from '../types'
import { decimalsFor } from './money'

/** Rates expressed as "units of currency per 1 unit of the base" (base = USD). */
export type RatesPerBase = Record<CurrencyCode, number>

/**
 * Conversion factor in MAJOR units: how many `to` per 1 `from`.
 * rates are per-base, so factor = rates[to] / rates[from].
 */
export function convertRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesPerBase,
): number {
  if (from === to) return 1
  const rFrom = rates[from]
  const rTo = rates[to]
  if (!rFrom || !rTo) return 0
  return rTo / rFrom
}

/** Convert a minor-unit amount from one currency to another's minor units. */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesPerBase,
): number {
  if (from === to) return minor
  const major = minor / 10 ** decimalsFor(from)
  const factor = convertRate(from, to, rates)
  return Math.round(major * factor * 10 ** decimalsFor(to))
}

// --- Fetching + caching (browser only) ---

const CACHE_KEY = 'fx_rates_v1'
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD' // free, no key, has ARS

interface CachedRates {
  day: string // YYYY-MM-DD
  rates: RatesPerBase
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Load USD-based rates, cached once per calendar day in localStorage. */
export async function loadRates(): Promise<RatesPerBase> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw) as CachedRates
      if (cached.day === today()) return cached.rates
    }
  } catch {
    // ignore cache read errors
  }

  const res = await fetch(ENDPOINT)
  const data = (await res.json()) as { rates: RatesPerBase }
  const rates = data.rates ?? {}
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ day: today(), rates } satisfies CachedRates),
    )
  } catch {
    // ignore cache write errors (private mode, quota)
  }
  return rates
}
