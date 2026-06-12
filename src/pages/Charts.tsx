import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useAuth } from '../hooks/useAuth'
import { useBudgets } from '../hooks/useBudgets'
import {
  currenciesIn,
  spendByCategory,
  spendByMonth,
} from '../lib/analytics'
import { monthKey } from '../lib/forecast'
import { formatMoney, toMajor, toMinor } from '../lib/money'
import { deleteBudget, setBudget } from '../lib/firestore'

const COLORS = ['#4f46e5', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Charts() {
  const { expenses } = useAllExpenses()
  const { user } = useAuth()
  const budgets = useBudgets()
  const currencies = currenciesIn(expenses)
  const [currency, setCurrency] = useState('')
  const [trendYear, setTrendYear] = useState('all')
  const cur = currency || currencies[0] || 'ARS'
  const thisMonth = monthKey(Date.now())

  const byCategory = useMemo(
    () => (user ? spendByCategory(expenses, user.uid, cur, thisMonth) : {}),
    [expenses, user, cur, thisMonth],
  )
  const byMonth = useMemo(
    () => (user ? spendByMonth(expenses, user.uid, cur) : []),
    [expenses, user, cur],
  )

  const pieData = Object.entries(byCategory).map(([name, value]) => ({
    name: capitalize(name),
    value: toMajor(value, cur),
  }))
  const trendYears = [...new Set(byMonth.map((m) => m.month.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a),
  )
  const barData = byMonth
    .filter((m) => trendYear === 'all' || m.month.startsWith(trendYear))
    .map((m) => ({ month: m.month, value: toMajor(m.total, cur) }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Charts & budgets</h1>
        {currencies.length > 1 && (
          <select
            value={cur}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
          This month by category ({cur})
        </h2>
        {pieData.length === 0 ? (
          <p className="text-slate-400">No spending this month.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Monthly trend ({cur})
          </h2>
          <select
            value={trendYear}
            onChange={(e) => setTrendYear(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="all">All time</option>
            {trendYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {barData.length === 0 ? (
          <p className="text-slate-400">No data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="month" fontSize={10} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Budgets ({cur}, this month)
        </h2>
        {Object.keys(byCategory).length === 0 && (
          <p className="text-slate-400">Spend something to set budgets.</p>
        )}
        {Object.keys(byCategory).map((cat) => {
          const spent = byCategory[cat]
          const budget = budgets.find((b) => b.category === cat && b.currency === cur)
          const cap = budget?.monthlyCap ?? 0
          const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0
          const over = cap > 0 && spent > cap
          return (
            <div
              key={cat}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{cat}</span>
                <span
                  className={
                    over
                      ? 'font-medium text-red-600'
                      : 'text-slate-500 dark:text-zinc-400'
                  }
                >
                  {formatMoney(spent, cur)}
                  {cap > 0 && ` / ${formatMoney(cap, cur)}`}
                </span>
              </div>
              {cap > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-700">
                  <div
                    className={over ? 'h-full bg-red-500' : 'h-full bg-indigo-500'}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Set monthly cap…"
                  defaultValue={cap ? toMajor(cap, cur) : ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (user && v)
                      void setBudget(user.uid, cat, toMinor(v, cur), cur)
                  }}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                />
                {cap > 0 && user && (
                  <button
                    type="button"
                    onClick={() => void deleteBudget(user.uid, cat)}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                    title="Remove cap"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
