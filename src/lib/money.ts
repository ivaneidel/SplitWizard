// Money helpers. All amounts are integer MINOR units (cents) unless noted.

/** Currencies with 0 decimal places (no minor unit). */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'CLP', 'VND', 'ISK'])

export function decimalsFor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2
}

/** Parse a user-entered major-unit string ("12.34") into minor units (1234). */
export function toMinor(input: string | number, currency = 'USD'): number {
  const decimals = decimalsFor(currency)
  const factor = 10 ** decimals
  const value = typeof input === 'number' ? input : parseFloat(input)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * factor)
}

/** Convert minor units back to a major-unit number (1234 -> 12.34). */
export function toMajor(minor: number, currency = 'USD'): number {
  return minor / 10 ** decimalsFor(currency)
}

/** Format minor units as a localized currency string. */
export function formatMoney(
  minor: number,
  currency = 'USD',
  locale = 'es-AR',
): string {
  const decimals = decimalsFor(currency)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(toMajor(minor, currency))
  } catch {
    // Unknown currency code -> plain number with the code suffix.
    return `${toMajor(minor, currency).toFixed(decimals)} ${currency}`
  }
}

/**
 * Split a total into `parts` integer minor-unit chunks that sum EXACTLY to the
 * total. Remainder cents are distributed one-per-chunk to the earliest chunks.
 */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return []
  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const base = Math.floor(abs / parts)
  let remainder = abs - base * parts
  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    return sign * (base + extra)
  })
}

/**
 * Distribute a total across `weights` proportionally, in integer minor units,
 * summing EXACTLY to the total. Largest-remainder method for the leftover cents.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return splitEvenly(total, weights.length)

  const raw = weights.map((w) => (total * w) / totalWeight)
  const floored = raw.map((r) => Math.floor(r))
  let remainder = total - floored.reduce((a, b) => a + b, 0)

  // Hand out the leftover units to the entries with the largest fractional part.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floored]
  for (const { i } of order) {
    if (remainder <= 0) break
    result[i] += 1
    remainder -= 1
  }
  return result
}
