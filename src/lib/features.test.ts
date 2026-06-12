import { describe, expect, it } from 'vitest'
import { parseWorkbook, reconstructExpenses, type ImportedExpense } from './excel'
import {
  detectInstallmentPlans,
  parseInstallmentTitle,
} from './installmentDetect'
import { remapKey, remapList } from './claim'
import { formatDate, monthYearLabel } from './date'
import { forecastByMonth, monthKey, planProgress } from './forecast'
import type { Expense } from '../types'

const sum = (m: Record<string, number>) =>
  Object.values(m).reduce((a, b) => a + b, 0)

describe('excel reconstruction', () => {
  it('reproduces balances and skips the total row (English)', () => {
    const csv =
      'Date,Description,Category,Cost,Currency,Alice,Bob\n' +
      '2026-01-05,Dinner,dining,100,USD,50,-50\n' +
      '2026-01-31,Total balance,,,USD,50,-50\n'
    const parsed = parseWorkbook(csv)
    expect(parsed.personColumns).toEqual(['Alice', 'Bob'])
    const exps = reconstructExpenses(parsed, { Alice: 'a', Bob: 'b' }, 'USD')
    expect(exps).toHaveLength(1)
    const e = exps[0]
    expect(e.amount).toBe(10000)
    expect(sum(e.paidBy)).toBe(10000)
    expect(sum(e.splits)).toBe(10000)
    expect((e.paidBy.a ?? 0) - (e.splits.a ?? 0)).toBe(5000)
    expect((e.paidBy.b ?? 0) - (e.splits.b ?? 0)).toBe(-5000)
  })

  it('handles Spanish headers, accents and a "Saldo total" row', () => {
    // Mirrors the user's real export (positional fixed columns + people).
    const csv =
      'Fecha,Descripción,Categoría,Coste,Moneda,Ivan Eidel,Sofia Pinto kober\n' +
      '2026-01-03,Carrefour,Alimentos,28000.00,ARS,-14000.00,14000.00\n' +
      '2026-06-11,Saldo total, , ,ARS,103312.00,-103312.00\n'
    const parsed = parseWorkbook(csv)
    expect(parsed.cols.cost).toBe('Coste')
    expect(parsed.personColumns).toEqual(['Ivan Eidel', 'Sofia Pinto kober'])

    const exps = reconstructExpenses(
      parsed,
      { 'Ivan Eidel': 'ivan', 'Sofia Pinto kober': 'sofia' },
      'ARS',
    )
    expect(exps).toHaveLength(1) // totals row skipped
    const e = exps[0]
    expect(e.description).toBe('Carrefour')
    expect(e.category).toBe('alimentos')
    expect(e.amount).toBe(2800000)
    // Sofia is owed 14000 (paid), Ivan owes 14000.
    expect((e.paidBy.sofia ?? 0) - (e.splits.sofia ?? 0)).toBe(1400000)
    expect((e.paidBy.ivan ?? 0) - (e.splits.ivan ?? 0)).toBe(-1400000)
    expect(sum(e.splits)).toBe(2800000)
  })
})

describe('installment detection', () => {
  const mk = (
    description: string,
    date: number,
    over: Partial<ImportedExpense> = {},
  ): ImportedExpense => ({
    description,
    date,
    category: 'general',
    amount: 1000,
    currency: 'USD',
    paidBy: { a: 1000 },
    splits: { a: 500, b: 500 },
    participantUids: ['a', 'b'],
    ...over,
  })

  it('parses "Base N/M" titles', () => {
    expect(parseInstallmentTitle('Tele 3/10')).toEqual({
      base: 'Tele',
      index: 3,
      count: 10,
    })
    expect(parseInstallmentTitle('Dinner')).toBeNull()
    expect(parseInstallmentTitle('X 5/3')).toBeNull() // index > count
  })

  it('groups a consecutive, same-amount/split series into one plan', () => {
    const { plans, singles } = detectInstallmentPlans([
      mk('Tele 1/3', Date.UTC(2026, 0, 5)),
      mk('Tele 2/3', Date.UTC(2026, 1, 5)),
      mk('Tele 3/3', Date.UTC(2026, 2, 5)),
    ])
    expect(singles).toHaveLength(0)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ baseDescription: 'Tele', count: 3 })
    expect(plans[0].rows.map((r) => r.installmentIndex)).toEqual([1, 2, 3])
  })

  it('does NOT group when months are non-consecutive', () => {
    const { plans, singles } = detectInstallmentPlans([
      mk('Tele 1/3', Date.UTC(2026, 0, 5)),
      mk('Tele 3/3', Date.UTC(2026, 5, 5)), // gap, wrong month
    ])
    expect(plans).toHaveLength(0)
    expect(singles).toHaveLength(2)
  })

  it('does NOT group when amounts differ', () => {
    const { plans, singles } = detectInstallmentPlans([
      mk('Tele 1/2', Date.UTC(2026, 0, 5), { amount: 1000 }),
      mk('Tele 2/2', Date.UTC(2026, 1, 5), { amount: 2000 }),
    ])
    expect(plans).toHaveLength(0)
    expect(singles).toHaveLength(2)
  })

  it('leaves a lone installment as a single', () => {
    const { plans, singles } = detectInstallmentPlans([
      mk('X 1/5', Date.UTC(2026, 0, 5)),
    ])
    expect(plans).toHaveLength(0)
    expect(singles).toHaveLength(1)
  })

  it('partitions a mixed batch', () => {
    const { plans, singles } = detectInstallmentPlans([
      mk('Tele 1/2', Date.UTC(2026, 0, 5)),
      mk('Tele 2/2', Date.UTC(2026, 1, 5)),
      mk('Carrefour', Date.UTC(2026, 0, 9)),
    ])
    expect(plans).toHaveLength(1)
    expect(singles.map((s) => s.description)).toEqual(['Carrefour'])
  })
})

describe('date formatting', () => {
  it('formats UTC midnight as YYYY-MM-DD (round-trips the stored value)', () => {
    const ms = Date.parse('2026-01-05') // UTC midnight, how expenses are stored
    expect(formatDate(ms)).toBe('2026-01-05')
    expect(formatDate(Date.UTC(2026, 11, 31))).toBe('2026-12-31')
  })

  it('labels the month/year in UTC', () => {
    expect(monthYearLabel(Date.UTC(2026, 5, 1))).toBe('June 2026')
  })
})

describe('claim remapping', () => {
  it('renames a key', () => {
    expect(remapKey({ guest: 100, x: 50 }, 'guest', 'real')).toEqual({
      real: 100,
      x: 50,
    })
  })

  it('sums when the target key already exists', () => {
    expect(remapKey({ guest: 100, real: 30 }, 'guest', 'real')).toEqual({
      real: 130,
    })
  })

  it('remaps and de-dupes an id list', () => {
    expect(remapList(['guest', 'x', 'real'], 'guest', 'real')).toEqual(['real', 'x'])
    expect(remapList(['x', 'guest'], 'guest', 'real')).toEqual(['x', 'real'])
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
