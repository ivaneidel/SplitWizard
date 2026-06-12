import type { AmountMap, CurrencyCode, Expense, Settlement } from '../types'

/** uid -> net minor units. Positive = is owed; negative = owes. */
export type NetMap = AmountMap
/** currency -> net map. Each inner map sums to exactly 0 (zero-sum ledger). */
export type CurrencyBalances = Record<CurrencyCode, NetMap>

/**
 * Fold expenses + settlements into a net balance per user, kept PER CURRENCY so
 * every currency's ledger stays an exact zero-sum (no cross-currency rounding).
 * Settle-up math therefore always happens within a single currency.
 */
export function computeBalances(
  expenses: Expense[],
  settlements: Settlement[],
): CurrencyBalances {
  const out: CurrencyBalances = {}

  const bump = (cur: CurrencyCode, uid: string, delta: number) => {
    ;(out[cur] ??= {})[uid] = (out[cur][uid] ?? 0) + delta
  }

  for (const e of expenses) {
    if (e.deleted) continue
    const uids = new Set([...Object.keys(e.paidBy), ...Object.keys(e.splits)])
    for (const uid of uids) {
      bump(e.currency, uid, (e.paidBy[uid] ?? 0) - (e.splits[uid] ?? 0))
    }
  }

  for (const s of settlements) {
    // `from` paid `to`: from's debt shrinks (+), to is owed less (-).
    bump(s.currency, s.from, s.amount)
    bump(s.currency, s.to, -s.amount)
  }

  return out
}

export interface Debt {
  from: string
  to: string
  amount: number
  currency: CurrencyCode
}

/**
 * Greedy min-cash-flow: reduce a currency's net map to the fewest transfers.
 * Repeatedly settles the biggest creditor against the biggest debtor.
 */
export function simplifyDebts(net: NetMap, currency: CurrencyCode): Debt[] {
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([uid, v]) => ({ uid, amount: v }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([uid, v]) => ({ uid, amount: -v }))
    .sort((a, b) => b.amount - a.amount)

  const debts: Debt[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]
    const d = debtors[di]
    const pay = Math.min(c.amount, d.amount)
    if (pay > 0) {
      debts.push({ from: d.uid, to: c.uid, amount: pay, currency })
    }
    c.amount -= pay
    d.amount -= pay
    if (c.amount === 0) ci++
    if (d.amount === 0) di++
  }
  return debts
}

/** Simplify every currency in a balances map. */
export function simplifyAll(balances: CurrencyBalances): Debt[] {
  return Object.entries(balances).flatMap(([cur, net]) => simplifyDebts(net, cur))
}

/**
 * Estimated single-number total of a user's position across all currencies,
 * converted to `displayCurrency` using a current rate map (NOT used for
 * settle-up — that is always per-currency). `rates[cur]` = display units per
 * 1 unit of `cur`. Returned in minor units of `displayCurrency` (approx).
 */
export function estimatedNetTotal(
  balances: CurrencyBalances,
  uid: string,
  displayCurrency: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number {
  let total = 0
  for (const [cur, net] of Object.entries(balances)) {
    const v = net[uid] ?? 0
    const rate = cur === displayCurrency ? 1 : (rates[cur] ?? 0)
    total += Math.round(v * rate)
  }
  return total
}
