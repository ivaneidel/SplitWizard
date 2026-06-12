import { describe, expect, it } from 'vitest'
import { reconstructExpenses, type ParsedSheet } from './excel'
import { forecastByMonth, monthKey, planProgress } from './forecast'
import type { Expense } from '../types'

const sum = (m: Record<string, number>) =>
  Object.values(m).reduce((a, b) => a + b, 0)

describe('excel reconstruction', () => {
  const sheet: ParsedSheet = {
    personColumns: ['Alice', 'Bob'],
    rows: [
      // Alice paid 100, split equally => Alice net +50, Bob net -50.
      { Date: '2026-01-05', Description: 'Dinner', Category: 'dining', Cost: '100', Currency: 'USD', Alice: '50', Bob: '-50' },
      // The trailing summary row must be ignored.
      { Date: '', Description: 'Total balance', Category: '', Cost: '', Currency: 'USD', Alice: '50', Bob: '-50' },
    ],
  }

  it('reproduces balances and skips the total row', () => {
    const exps = reconstructExpenses(sheet, { Alice: 'a', Bob: 'b' }, 'USD')
    expect(exps).toHaveLength(1)
    const e = exps[0]
    expect(e.amount).toBe(10000)
    expect(e.currency).toBe('USD')
    // payer paid full cost; splits sum to cost
    expect(sum(e.paidBy)).toBe(10000)
    expect(sum(e.splits)).toBe(10000)
    // net per person matches the source (paid - owed)
    expect((e.paidBy.a ?? 0) - (e.splits.a ?? 0)).toBe(5000)
    expect((e.paidBy.b ?? 0) - (e.splits.b ?? 0)).toBe(-5000)
  })

  it('handles a 3-way uneven split preserving nets', () => {
    const s: ParsedSheet = {
      personColumns: ['A', 'B', 'C'],
      rows: [
        { Date: '2026-02-01', Description: 'Trip', Category: 'travel', Cost: '90', Currency: 'USD', A: '60', B: '-30', C: '-30' },
      ],
    }
    const [e] = reconstructExpenses(s, { A: 'a', B: 'b', C: 'c' }, 'USD')
    expect(sum(e.splits)).toBe(9000)
    expect((e.paidBy.a ?? 0) - (e.splits.a ?? 0)).toBe(6000)
    expect((e.paidBy.b ?? 0) - (e.splits.b ?? 0)).toBe(-3000)
    expect((e.paidBy.c ?? 0) - (e.splits.c ?? 0)).toBe(-3000)
  })
})

describe('forecast', () => {
  const mk = (over: Partial<Expense>): Expense => ({
    id: Math.random().toString(36).slice(2),
    groupId: 'g',
    description: 'TV 1/3',
    amount: 1000,
    currency: 'USD',
    fxRate: 1,
    category: 'electronics',
    date: 0,
    splitMode: 'exact',
    paidBy: {},
    splits: { me: 1000 },
    participantUids: ['me'],
    createdBy: 'me',
    createdAt: 0,
    updatedAt: 0,
    installmentPlanId: 'plan1',
    ...over,
  })

  it('monthKey buckets by UTC year-month', () => {
    expect(monthKey(Date.UTC(2026, 0, 5))).toBe('2026-01')
    expect(monthKey(Date.UTC(2026, 11, 31))).toBe('2026-12')
  })

  it('groups upcoming installments by month and sums user share', () => {
    const now = Date.UTC(2026, 0, 1)
    const exps = [
      mk({ description: 'TV 1/3', date: Date.UTC(2026, 0, 5), splits: { me: 1000 } }),
      mk({ description: 'TV 2/3', date: Date.UTC(2026, 1, 5), splits: { me: 1000 } }),
      mk({ description: 'TV 3/3', date: Date.UTC(2026, 2, 5), splits: { me: 1000 } }),
    ]
    const f = forecastByMonth(exps, 'me', now)
    expect(f.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(f[0].totalByCurrency.USD).toBe(1000)
  })

  it('excludes past months and non-installment rows', () => {
    const now = Date.UTC(2026, 5, 1)
    const exps = [
      mk({ date: Date.UTC(2026, 0, 5) }), // past
      mk({ date: Date.UTC(2026, 6, 5) }), // future
      mk({ date: Date.UTC(2026, 6, 5), installmentPlanId: undefined }), // not a plan
    ]
    const f = forecastByMonth(exps, 'me', now)
    expect(f).toHaveLength(1)
    expect(f[0].month).toBe('2026-07')
  })

  it('planProgress counts paid vs upcoming', () => {
    const now = Date.UTC(2026, 1, 15)
    const exps = [
      mk({ description: 'TV 1/3', date: Date.UTC(2026, 0, 5) }),
      mk({ description: 'TV 2/3', date: Date.UTC(2026, 1, 5) }),
      mk({ description: 'TV 3/3', date: Date.UTC(2026, 2, 5) }),
    ]
    const [p] = planProgress(exps, now)
    expect(p.baseDescription).toBe('TV')
    expect(p.paid).toBe(2)
    expect(p.total).toBe(3)
    expect(p.nextDate).toBe(Date.UTC(2026, 2, 5))
  })
})
