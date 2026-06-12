import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useAuth } from '../hooks/useAuth'
import { forecastByMonth, planProgress, type PlanProgress } from '../lib/forecast'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/date'

const MONTH_FMT = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return MONTH_FMT.format(new Date(Date.UTC(y, m - 1, 1)))
}

function PlanCard({ p, dim }: { p: PlanProgress; dim?: boolean }) {
  return (
    <li
      className={`rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800 ${
        dim ? 'opacity-70' : ''
      }`}
    >
      <div className="flex justify-between">
        <span className="font-medium">{p.baseDescription}</span>
        <span className="text-sm text-slate-500">
          {p.paid}/{p.total} paid
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-700">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${(p.paid / p.total) * 100}%` }}
        />
      </div>
      {p.nextDate && (
        <div className="mt-1 text-xs text-slate-400">Next: {formatDate(p.nextDate)}</div>
      )}
    </li>
  )
}

export function Installments() {
  const { expenses, loading } = useAllExpenses()
  const { user } = useAuth()
  const now = Date.now()
  const [showDone, setShowDone] = useState(false)

  const forecast = useMemo(
    () => (user ? forecastByMonth(expenses, user.uid, now) : []),
    [expenses, user, now],
  )
  const plans = useMemo(() => planProgress(expenses, now), [expenses, now])
  const active = plans.filter((p) => p.paid < p.total)
  const done = plans.filter((p) => p.total > 0 && p.paid >= p.total)
  const nextMonth = forecast[0]

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <CalendarClock size={22} /> Installments
      </h1>

      {loading && <p className="text-slate-400">Loading…</p>}
      {!loading && plans.length === 0 && (
        <p className="text-slate-500">
          No installment plans yet. Create one from “Add expense → Split into
          monthly installments”.
        </p>
      )}

      {nextMonth && (
        <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950">
          <div className="text-sm text-emerald-700 dark:text-emerald-400">
            Due {monthLabel(nextMonth.month)}
          </div>
          <div className="mt-1 space-x-2 text-lg font-bold text-emerald-800 dark:text-emerald-300">
            {Object.entries(nextMonth.totalByCurrency).map(([cur, amt]) => (
              <span key={cur}>{formatMoney(amt, cur)}</span>
            ))}
          </div>
          <div className="text-xs text-emerald-600">
            across {nextMonth.expenses.length} commitment
            {nextMonth.expenses.length > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Active plans */}
      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Plans
          </h2>
          <ul className="space-y-2">
            {active.map((p) => (
              <PlanCard key={p.planId} p={p} />
            ))}
          </ul>
        </section>
      )}

      {/* Completed plans (collapsed) */}
      {done.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="text-sm font-semibold text-slate-500 dark:text-zinc-400"
          >
            {showDone ? '▾' : '▸'} Completed ({done.length})
          </button>
          {showDone && (
            <ul className="space-y-2">
              {done.map((p) => (
                <PlanCard key={p.planId} p={p} dim />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Month-by-month timeline */}
      {forecast.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Upcoming by month
          </h2>
          {forecast.map((m) => (
            <div
              key={m.month}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex justify-between">
                <span className="font-medium">{monthLabel(m.month)}</span>
                <span className="space-x-2 font-medium text-slate-500 dark:text-zinc-400">
                  {Object.entries(m.totalByCurrency).map(([cur, amt]) => (
                    <span key={cur}>{formatMoney(amt, cur)}</span>
                  ))}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-zinc-700/60">
                {m.expenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between py-1.5 text-sm"
                  >
                    <span>{e.description}</span>
                    <span className="text-slate-400">
                      {formatMoney(e.splits[user?.uid ?? ''] ?? 0, e.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
