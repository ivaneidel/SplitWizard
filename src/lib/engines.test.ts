import { describe, expect, it } from 'vitest'
import {
  decimalsFor,
  formatMoney,
  splitByWeights,
  splitEvenly,
  toMinor,
} from './money'
import { computeSplits, splitsAreValid } from './splits'
import { computeBalances, simplifyAll, simplifyDebts } from './balances'
import {
  amountsDrift,
  generateInstallments,
  installmentDate,
  redistributeInstallments,
  type PlanRowLike,
} from './installments'
import { convertMinor, convertRate } from './fx'
import type { Expense, Settlement } from '../types'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('money', () => {
  it('parses major to minor units', () => {
    expect(toMinor('12.34', 'USD')).toBe(1234)
    expect(toMinor('100', 'USD')).toBe(10000)
    expect(toMinor('1000', 'JPY')).toBe(1000) // zero-decimal
  })

  it('knows zero-decimal currencies', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('ARS')).toBe(2)
  })

  it('formats without throwing on unknown codes', () => {
    expect(() => formatMoney(1234, 'ZZZ')).not.toThrow()
  })

  it('splitEvenly distributes remainder cents and sums exactly', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33])
    expect(sum(splitEvenly(100, 3))).toBe(100)
    expect(sum(splitEvenly(10001, 7))).toBe(10001)
  })

  it('splitByWeights is proportional and exact', () => {
    expect(sum(splitByWeights(1000, [1, 1, 1]))).toBe(1000)
    expect(sum(splitByWeights(1000, [50, 30, 20]))).toBe(1000)
    expect(splitByWeights(1000, [50, 50])).toEqual([500, 500])
    expect(sum(splitByWeights(999, [1, 2, 3, 4]))).toBe(999)
  })
})

describe('computeSplits', () => {
  const p = ['a', 'b', 'c']

  it('equal split sums to total', () => {
    const s = computeSplits({ amount: 100, participants: p, mode: 'equal' })
    expect(sum(Object.values(s))).toBe(100)
    expect(splitsAreValid(100, s)).toBe(true)
  })

  it('percent split sums to total', () => {
    const s = computeSplits({
      amount: 1000,
      participants: p,
      mode: 'percent',
      percent: { a: 50, b: 30, c: 20 },
    })
    expect(s).toEqual({ a: 500, b: 300, c: 200 })
  })

  it('shares split sums to total', () => {
    const s = computeSplits({
      amount: 1000,
      participants: p,
      mode: 'shares',
      shares: { a: 2, b: 1, c: 1 },
    })
    expect(sum(Object.values(s))).toBe(1000)
    expect(s.a).toBe(500)
  })

  it('adjustment: extras on top of an equal split, sums to total', () => {
    const s = computeSplits({
      amount: 1000,
      participants: ['a', 'b'],
      mode: 'adjustment',
      adjustment: { a: 200 }, // a owes 200 extra
    })
    // remainder 800 split equally (400/400), plus a's 200 adjustment
    expect(s).toEqual({ a: 600, b: 400 })
    expect(splitsAreValid(1000, s)).toBe(true)
  })

  it('itemized: per-item equal split accumulates per user', () => {
    const s = computeSplits({
      amount: 300,
      participants: ['a', 'b'],
      mode: 'itemized',
      items: [
        { amount: 100, sharedBy: ['a'] },
        { amount: 200, sharedBy: ['a', 'b'] },
      ],
    })
    expect(s).toEqual({ a: 200, b: 100 })
  })
})

describe('balances', () => {
  const mkExpense = (over: Partial<Expense>): Expense => ({
    id: 'x',
    groupId: 'g',
    description: '',
    amount: 0,
    currency: 'USD',
    fxRate: 1,
    category: 'general',
    date: 0,
    splitMode: 'equal',
    paidBy: {},
    splits: {},
    participantUids: [],
    createdBy: 'a',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })

  it('nets to zero per currency', () => {
    const expenses = [
      mkExpense({ amount: 100, paidBy: { a: 100 }, splits: { a: 50, b: 50 } }),
    ]
    const bal = computeBalances(expenses, [])
    expect(bal.USD).toEqual({ a: 50, b: -50 })
    expect(sum(Object.values(bal.USD))).toBe(0)
  })

  it('keeps currencies separate', () => {
    const expenses = [
      mkExpense({ amount: 100, paidBy: { a: 100 }, splits: { a: 50, b: 50 } }),
      mkExpense({
        currency: 'ARS',
        amount: 1000,
        paidBy: { b: 1000 },
        splits: { a: 500, b: 500 },
      }),
    ]
    const bal = computeBalances(expenses, [])
    expect(bal.USD).toEqual({ a: 50, b: -50 })
    expect(bal.ARS).toEqual({ a: -500, b: 500 })
  })

  it('ignores deleted expenses', () => {
    const bal = computeBalances(
      [mkExpense({ amount: 100, paidBy: { a: 100 }, splits: { b: 100 }, deleted: true })],
      [],
    )
    expect(bal.USD?.a ?? 0).toBe(0)
  })

  it('settlement reduces debt', () => {
    const expenses = [
      mkExpense({ amount: 100, paidBy: { a: 100 }, splits: { a: 50, b: 50 } }),
    ]
    const settlement: Settlement = {
      id: 's',
      groupId: 'g',
      from: 'b',
      to: 'a',
      amount: 50,
      currency: 'USD',
      fxRate: 1,
      date: 0,
      createdBy: 'b',
      createdAt: 0,
    }
    const bal = computeBalances(expenses, [settlement])
    expect(bal.USD).toEqual({ a: 0, b: 0 })
  })
})

describe('simplifyDebts', () => {
  it('minimizes transfers and conserves totals', () => {
    // a is owed 100, b owes 60, c owes 40
    const debts = simplifyDebts({ a: 100, b: -60, c: -40 }, 'USD')
    expect(debts).toHaveLength(2)
    expect(sum(debts.map((d) => d.amount))).toBe(100)
    expect(debts.every((d) => d.to === 'a')).toBe(true)
  })

  it('simplifyAll spans currencies', () => {
    const debts = simplifyAll({
      USD: { a: 50, b: -50 },
      ARS: { a: -500, b: 500 },
    })
    expect(debts).toHaveLength(2)
    expect(debts.find((d) => d.currency === 'USD')?.from).toBe('b')
    expect(debts.find((d) => d.currency === 'ARS')?.from).toBe('a')
  })
})

describe('installments', () => {
  it('generates N balanced rows summing to total', () => {
    const rows = generateInstallments({
      baseDescription: 'TV',
      totalAmount: 10000, // 100.00
      count: 10,
      dayOfMonth: 5,
      startDate: Date.UTC(2026, 0, 5),
      currency: 'USD',
      category: 'electronics',
      paidBy: { me: 10000 },
      splits: { me: 5000, you: 5000 },
    })
    expect(rows).toHaveLength(10)
    expect(rows[0].description).toBe('TV 1/10')
    expect(rows[9].description).toBe('TV 10/10')
    expect(sum(rows.map((r) => r.amount))).toBe(10000)
    // every installment internally balanced
    for (const r of rows) {
      expect(sum(Object.values(r.paidBy))).toBe(r.amount)
      expect(sum(Object.values(r.splits))).toBe(r.amount)
    }
  })

  it('handles uneven totals (remainder on early installments)', () => {
    const rows = generateInstallments({
      baseDescription: 'X',
      totalAmount: 10001,
      count: 3,
      dayOfMonth: 1,
      startDate: Date.UTC(2026, 0, 1),
      currency: 'USD',
      category: 'general',
      paidBy: { a: 10001 },
      splits: { a: 10001 },
    })
    expect(rows.map((r) => r.amount)).toEqual([3334, 3334, 3333])
    expect(sum(rows.map((r) => r.amount))).toBe(10001)
  })

  it('steps one month and clamps day-of-month', () => {
    // Jan 31 + 1 month -> Feb 28 (2026 not a leap year)
    const d = new Date(installmentDate(Date.UTC(2026, 0, 31), 1, 31))
    expect(d.getUTCMonth()).toBe(1) // February
    expect(d.getUTCDate()).toBe(28)
  })
})

describe('installment bulk edit', () => {
  // Plan with a pricier first installment (the import-detection edge case).
  const drifted: PlanRowLike[] = [
    { id: 'a', description: 'TV 1/3', amount: 5000, installmentIndex: 1, paidBy: { me: 5000 }, splits: { me: 2500, you: 2500 } },
    { id: 'b', description: 'TV 2/3', amount: 1000, installmentIndex: 2, paidBy: { me: 1000 }, splits: { me: 500, you: 500 } },
    { id: 'c', description: 'TV 3/3', amount: 1000, installmentIndex: 3, paidBy: { me: 1000 }, splits: { me: 500, you: 500 } },
  ]

  it('flags drift when amounts are not an even split', () => {
    expect(amountsDrift(drifted)).toBe(true)
    expect(amountsDrift([{ amount: 3334 }, { amount: 3333 }])).toBe(false) // rounding only
    expect(amountsDrift([{ amount: 1000 }])).toBe(false)
  })

  it('redistributes a new total evenly and keeps i/M numbering', () => {
    const updates = redistributeInstallments(drifted, 9000, 'Television')
    expect(updates.map((u) => u.amount)).toEqual([3000, 3000, 3000])
    expect(sum(updates.map((u) => u.amount))).toBe(9000)
    expect(updates.map((u) => u.description)).toEqual([
      'Television 1/3',
      'Television 2/3',
      'Television 3/3',
    ])
    // Splits use the representative (most common) row's ratios; each row balanced.
    for (const u of updates) {
      expect(sum(Object.values(u.paidBy))).toBe(u.amount)
      expect(sum(Object.values(u.splits))).toBe(u.amount)
      expect(u.splits).toEqual({ me: 1500, you: 1500 })
    }
  })

  it('puts the rounding remainder on the earliest installments', () => {
    const updates = redistributeInstallments(drifted, 10001, 'TV')
    expect(updates.map((u) => u.amount)).toEqual([3334, 3334, 3333])
  })
})

describe('fx', () => {
  const rates = { USD: 1, ARS: 1000, EUR: 0.9 }

  it('computes cross rates from a per-base map', () => {
    expect(convertRate('USD', 'ARS', rates)).toBe(1000)
    expect(convertRate('ARS', 'USD', rates)).toBe(0.001)
    expect(convertRate('USD', 'USD', rates)).toBe(1)
  })

  it('converts minor units respecting currency decimals', () => {
    // 1.00 USD -> 1000.00 ARS
    expect(convertMinor(100, 'USD', 'ARS', rates)).toBe(100000)
    // identity
    expect(convertMinor(1234, 'USD', 'USD', rates)).toBe(1234)
  })

  it('returns 0 factor for unknown currencies', () => {
    expect(convertRate('USD', 'ZZZ', rates)).toBe(0)
  })
})
