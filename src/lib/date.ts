// Dates are stored as epoch millis at UTC midnight of the chosen day
// (`Date.parse('YYYY-MM-DD')` and `Date.UTC(...)`), so format in UTC to round-trip
// exactly and avoid an off-by-one in negative-UTC timezones.
import { getLang } from '../i18n/lang'

/** YYYY-MM-DD (UTC). */
export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** e.g. "June 2026" / "junio de 2026" — for month section headers. */
export function monthYearLabel(ms: number): string {
  return new Intl.DateTimeFormat(getLang(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms))
}

/** Localized "Month Year" from a 'YYYY-MM' key (e.g. installment forecast). */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(getLang(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)))
}
