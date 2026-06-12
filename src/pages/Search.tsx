import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useGroups } from '../hooks/useGroups'
import { formatMoney, toMajor } from '../lib/money'
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
  'rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800'

export function Search() {
  const { expenses } = useAllExpenses()
  const { groups } = useGroups()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Search all over</h1>

      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800">
        <SearchIcon size={18} className="text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Description or amount…"
          className="w-full bg-transparent py-2 outline-none"
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label className="flex-1">
          <span className="text-slate-400">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 w-full ${INPUT}`}
          />
        </label>
        <label className="flex-1">
          <span className="text-slate-400">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 w-full ${INPUT}`}
          />
        </label>
      </div>

      {(q.trim() || from || to) && (
        <p className="text-sm text-slate-400">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
        {results.map((e) => (
          <li key={e.id}>
            <Link
              to={`/groups/${e.groupId}/expenses/${e.id}/edit`}
              className="flex items-center justify-between p-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div>
                <div className="font-medium">{e.description}</div>
                <div className="text-xs text-slate-400">
                  {new Date(e.date).toLocaleDateString()} · {groupName(e.groupId)} ·{' '}
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
