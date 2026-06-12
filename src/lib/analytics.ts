import type { Expense } from '../types'
import { monthKey } from './forecast'

/** Sum the user's own share, grouped by category, for one currency. */
export function spendByCategory(
  expenses: Expense[],
  uid: string,
  currency: string,
  month?: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of expenses) {
    if (e.deleted || e.currency !== currency) continue
    if (month && monthKey(e.date) !== month) continue
    const share = e.splits[uid] ?? 0
    if (share <= 0) continue
    out[e.category] = (out[e.category] ?? 0) + share
  }
  return out
}

export interface MonthSpend {
  month: string
  total: number
}

/** The user's share per month for one currency, chronological. */
export function spendByMonth(
  expenses: Expense[],
  uid: string,
  currency: string,
): MonthSpend[] {
  const byMonth = new Map<string, number>()
  for (const e of expenses) {
    if (e.deleted || e.currency !== currency) continue
    const share = e.splits[uid] ?? 0
    if (share <= 0) continue
    const k = monthKey(e.date)
    byMonth.set(k, (byMonth.get(k) ?? 0) + share)
  }
  return [...byMonth.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * The user's own net (paid − owed) per currency for a given month bucket,
 * across whatever expenses are passed in. Positive = you lent; negative = you owe.
 */
export function userMonthlyNet(
  expenses: Expense[],
  uid: string,
  month: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of expenses) {
    if (e.deleted || monthKey(e.date) !== month) continue
    const net = (e.paidBy[uid] ?? 0) - (e.splits[uid] ?? 0)
    if (net === 0) continue
    out[e.currency] = (out[e.currency] ?? 0) + net
  }
  return out
}

/** Distinct currencies present in the expense set. */
export function currenciesIn(expenses: Expense[]): string[] {
  return [...new Set(expenses.filter((e) => !e.deleted).map((e) => e.currency))]
}
