import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useGroups } from '../hooks/useGroups'
import { formatMoney, toMajor } from '../lib/money'
import { formatDate } from '../lib/date'
import type { Expense } from '../types'

/** Match by description substring, or by amount when the query is numeric. */
function matchesText(e: Expense, q: string): boolean {
  const text = q.trim().toLowerCase()
  if (!text) return false
  if (e.description.toLowerCase().includes(text)) return true
  const num = parseFloat(text)
  if (!Number.isNaN(num)) {
    const major = toMajor(e.amount, e.currency)
    if (Math.abs(major - num) < 0.01) return true
    if (String(major).includes(text)) return true
  }
  return false
}

const INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800'

export function Search() {
  const { expenses } = useAllExpenses()
  const { groups } = useGroups()
  // Search state lives in the URL so the browser back button restores it
  // (Home → Search → edit an expense → back → same query + filters).
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const [showFilters, setShowFilters] = useState(false)

  const update = (key: string, val: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (val) next.set(key, val)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? 'Group'

  const results = useMemo(() => {
    const hasQuery = q.trim() !== ''
    const hasRange = Boolean(from || to)
    if (!hasQuery && !hasRange) return []
    const fromMs = from ? Date.parse(from) : -Infinity
    const toMs = to ? Date.parse(to) + 86_400_000 : Infinity // inclusive end-of-day
    return expenses
      .filter(
        (e) =>
          !e.deleted &&
          (!hasQuery || matchesText(e, q)) &&
          e.date >= fromMs &&
          e.date < toMs,
      )
      .sort((a, b) => b.date - a.date)
      .slice(0, 200)
  }, [expenses, q, from, to])

  const hasRange = Boolean(from || to)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Search all over</h1>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 dark:border-zinc-600 dark:bg-zinc-800">
          <SearchIcon size={18} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Description or amount…"
            className="w-full bg-transparent py-2 outline-none"
          />
        </div>

        {/* Filter popup */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative rounded-lg border p-2.5 ${
              hasRange
                ? 'border-emerald-500 text-emerald-600'
                : 'border-slate-300 text-slate-500 dark:border-zinc-600'
            }`}
            title="Date filter"
          >
            <SlidersHorizontal size={18} />
            {hasRange && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {showFilters && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFilters(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <label className="block text-sm">
                  <span className="text-slate-400">From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => update('from', e.target.value)}
                    className={`mt-1 w-full ${INPUT}`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-400">To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => update('to', e.target.value)}
                    className={`mt-1 w-full ${INPUT}`}
                  />
                </label>
                {hasRange && (
                  <button
                    type="button"
                    onClick={() => {
                      update('from', '')
                      update('to', '')
                    }}
                    className="text-sm text-slate-400"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {(q.trim() || hasRange) && (
        <p className="text-sm text-slate-400">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
        {results.map((e) => (
          <li key={e.id}>
            <Link
              to={`/groups/${e.groupId}/expenses/${e.id}/edit`}
              className="flex items-center justify-between p-3 transition hover:bg-slate-50 dark:hover:bg-zinc-700/50"
            >
              <div>
                <div className="font-medium">{e.description}</div>
                <div className="text-xs text-slate-400">
                  {formatDate(e.date)} · {groupName(e.groupId)} ·{' '}
                  <span className="capitalize">{e.category}</span>
                </div>
              </div>
              <div className="font-medium">{formatMoney(e.amount, e.currency)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
