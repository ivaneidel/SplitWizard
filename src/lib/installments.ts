import type { AmountMap, CurrencyCode } from '../types'
import { splitByWeights, splitEvenly } from './money'

export interface InstallmentConfig {
  baseDescription: string
  totalAmount: number // minor units
  count: number
  dayOfMonth: number // 1..31, clamped per month
  /** First installment date (epoch millis); subsequent ones step by 1 month. */
  startDate: number
  currency: CurrencyCode
  category: string
  /** TOTAL paid-by map (sums to totalAmount). Used as weights per installment. */
  paidBy: AmountMap
  /** TOTAL splits map (sums to totalAmount). Used as weights per installment. */
  splits: AmountMap
}

/** A ready-to-write expense (minus server-assigned id/timestamps). */
export interface ExpenseDraft {
  description: string
  amount: number
  currency: CurrencyCode
  category: string
  date: number
  splitMode: 'exact'
  paidBy: AmountMap
  splits: AmountMap
  participantUids: string[]
  installmentIndex: number
}

/**
 * Return the epoch millis of `dayOfMonth` in the month that is `monthsAhead`
 * after `from`, clamping the day to the month length (e.g. day 31 -> Feb 28).
 * Uses UTC to stay deterministic regardless of the runner's timezone.
 */
export function installmentDate(
  from: number,
  monthsAhead: number,
  dayOfMonth: number,
): number {
  const base = new Date(from)
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth() + monthsAhead
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(dayOfMonth, daysInTarget)
  return Date.UTC(year, month, day)
}

/**
 * Expand an installment plan into N expense drafts named "Base 1/N" … "Base N/N".
 * Each installment is internally balanced (its paidBy and splits both sum to the
 * installment's amount); the amounts themselves sum exactly to totalAmount.
 */
export function generateInstallments(cfg: InstallmentConfig): ExpenseDraft[] {
  const amounts = splitEvenly(cfg.totalAmount, cfg.count)
  const payerUids = Object.keys(cfg.paidBy)
  const splitUids = Object.keys(cfg.splits)
  const participantUids = Array.from(new Set([...payerUids, ...splitUids]))

  const payerWeights = payerUids.map((u) => cfg.paidBy[u])
  const splitWeights = splitUids.map((u) => cfg.splits[u])

  return amounts.map((amount, i) => {
    const paidParts = splitByWeights(amount, payerWeights)
    const splitParts = splitByWeights(amount, splitWeights)
    return {
      description: `${cfg.baseDescription} ${i + 1}/${cfg.count}`,
      amount,
      currency: cfg.currency,
      category: cfg.category,
      date: installmentDate(cfg.startDate, i, cfg.dayOfMonth),
      splitMode: 'exact',
      paidBy: zip(payerUids, paidParts),
      splits: zip(splitUids, splitParts),
      participantUids,
      installmentIndex: i + 1,
    }
  })
}

function zip(uids: string[], amounts: number[]): AmountMap {
  const map: AmountMap = {}
  uids.forEach((u, i) => {
    map[u] = amounts[i] ?? 0
  })
  return map
}
