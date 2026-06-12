// Dates are stored as epoch millis at UTC midnight of the chosen day
// (`Date.parse('YYYY-MM-DD')` and `Date.UTC(...)`), so format in UTC to round-trip
// exactly and avoid an off-by-one in negative-UTC timezones.

/** YYYY-MM-DD (UTC). */
export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

const MONTH_YEAR = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** e.g. "June 2026" — for month section headers. */
export function monthYearLabel(ms: number): string {
  return MONTH_YEAR.format(new Date(ms))
}
