import type { AmountMap } from '../types'
import type { ImportedExpense } from './excel'

export interface ParsedTitle {
  base: string
  index: number
  count: number
}

/** Parse a "Base N/M" title (e.g. "Tele 3/10"). Null if it doesn't match. */
export function parseInstallmentTitle(desc: string): ParsedTitle | null {
  const m = desc.trim().match(/^(.+?)\s+(\d+)\/(\d+)$/)
  if (!m) return null
  const index = parseInt(m[2], 10)
  const count = parseInt(m[3], 10)
  if (index < 1 || count < 1 || index > count) return null
  return { base: m[1].trim(), index, count }
}

export type PlanRow = ImportedExpense & { installmentIndex: number }

export interface DetectedPlan {
  baseDescription: string
  count: number
  currency: string
  category: string
  rows: PlanRow[] // sorted by installmentIndex
}

export interface DetectionResult {
  plans: DetectedPlan[]
  singles: ImportedExpense[]
}

/** Stable signature of an amount map: sorted "id:amount" pairs. */
function sig(map: AmountMap): string {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',')
}

/** Months since epoch for a UTC date — consecutive months differ by exactly 1. */
function monthIndex(ms: number): number {
  const d = new Date(ms)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/**
 * Partition imported expenses into installment plans and standalone expenses.
 * A group of "Base N/M" rows becomes a plan when it shares base title, M,
 * currency, amount, payer map and split map, AND contains at least two rows
 * with consecutive indices falling in consecutive months.
 */
export function detectInstallmentPlans(
  expenses: ImportedExpense[],
): DetectionResult {
  const groups = new Map<string, PlanRow[]>()
  const singles: ImportedExpense[] = []

  for (const e of expenses) {
    const parsed = parseInstallmentTitle(e.description)
    if (!parsed) {
      singles.push(e)
      continue
    }
    const key = [
      parsed.base,
      parsed.count,
      e.currency,
      e.amount,
      sig(e.paidBy),
      sig(e.splits),
    ].join('|')
    const row: PlanRow = { ...e, installmentIndex: parsed.index }
    const arr = groups.get(key)
    if (arr) arr.push(row)
    else groups.set(key, [row])
  }

  const plans: DetectedPlan[] = []
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.installmentIndex - b.installmentIndex)
    if (qualifies(rows)) {
      const first = rows[0]
      const parsed = parseInstallmentTitle(first.description)!
      plans.push({
        baseDescription: parsed.base,
        count: parsed.count,
        currency: first.currency,
        category: first.category,
        rows,
      })
    } else {
      // Not enough evidence — keep as ordinary expenses (strip the index tag).
      for (const r of rows) {
        const { installmentIndex: _drop, ...rest } = r
        void _drop
        singles.push(rest)
      }
    }
  }

  return { plans, singles }
}

/** True when some adjacent pair is consecutive in both index and month. */
function qualifies(rows: PlanRow[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    if (
      b.installmentIndex === a.installmentIndex + 1 &&
      monthIndex(b.date) === monthIndex(a.date) + 1
    ) {
      return true
    }
  }
  return false
}
