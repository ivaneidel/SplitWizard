import type { Expense } from '../types'

/** 'YYYY-MM' bucket key (UTC) for grouping by month. */
export function monthKey(date: number): string {
  const d = new Date(date)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface MonthForecast {
  month: string // 'YYYY-MM'
  /** The user's own share (minor units) due that month, per currency. */
  totalByCurrency: Record<string, number>
  expenses: Expense[]
}

/**
 * Upcoming installment/recurring charges grouped by month, from `from` onward.
 * Only counts rows that belong to an installment plan and are not deleted.
 * `totalByCurrency` is the signed-in user's own share that month.
 */
export function forecastByMonth(
  expenses: Expense[],
  uid: string,
  from: number,
): MonthForecast[] {
  const upcoming = expenses.filter(
    (e) => !e.deleted && e.installmentPlanId && e.date >= from,
  )
  const byMonth = new Map<string, MonthForecast>()

  for (const e of upcoming) {
    const key = monthKey(e.date)
    const bucket =
      byMonth.get(key) ?? { month: key, totalByCurrency: {}, expenses: [] }
    bucket.expenses.push(e)
    const share = e.splits[uid] ?? 0
    bucket.totalByCurrency[e.currency] =
      (bucket.totalByCurrency[e.currency] ?? 0) + share
    byMonth.set(key, bucket)
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export interface PlanProgress {
  planId: string
  baseDescription: string
  paid: number // installments whose date has passed (<= now)
  total: number
  currency: string
  /** Date of the next not-yet-due installment, if any. */
  nextDate?: number
}

/** Per-plan progress (e.g. "3/10 paid") derived from its expense rows. */
export function planProgress(expenses: Expense[], now: number): PlanProgress[] {
  const byPlan = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (e.deleted || !e.installmentPlanId) continue
    const arr = byPlan.get(e.installmentPlanId) ?? []
    arr.push(e)
    byPlan.set(e.installmentPlanId, arr)
  }

  return [...byPlan.entries()].map(([planId, rows]) => {
    rows.sort((a, b) => a.date - b.date)
    const paid = rows.filter((r) => r.date <= now).length
    const next = rows.find((r) => r.date > now)
    // Strip the trailing " i/N" to recover the base description.
    const base = rows[0].description.replace(/\s+\d+\/\d+$/, '')
    return {
      planId,
      baseDescription: base,
      paid,
      total: rows.length,
      currency: rows[0].currency,
      nextDate: next?.date,
    }
  })
}
