import { useMemo, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useGroups } from '../hooks/useGroups'
import { formatMoney, toMajor } from '../lib/money'
import type { Expense } from '../types'

/** Match by description substring, or by amount when the query is numeric. */
function matches(e: Expense, q: string): boolean {
  const text = q.trim().toLowerCase()
  if (!text) return false
  if (e.description.toLowerCase().includes(text)) return true
  const num = parseFloat(text)
  if (!Number.isNaN(num)) {
    const major = toMajor(e.amount, e.currency)
    // amount match within the currency's smallest displayed unit
    if (Math.abs(major - num) < 0.01) return true
    if (String(major).includes(text)) return true
  }
  return false
}

export function Search() {
  const { expenses } = useAllExpenses()
  const { groups } = useGroups()
  const [q, setQ] = useState('')

  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? 'Group'

  const results = useMemo(() => {
    if (!q.trim()) return []
    return expenses
      .filter((e) => !e.deleted && matches(e, q))
      .sort((a, b) => b.date - a.date)
      .slice(0, 200)
  }, [expenses, q])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Search all over</h1>

      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
        <SearchIcon size={18} className="text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Description or amount…"
          className="w-full py-2 outline-none"
        />
      </div>

      {q.trim() && (
        <p className="text-sm text-slate-400">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {results.map((e) => (
          <li key={e.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{e.description}</div>
              <div className="text-xs text-slate-400">
                {new Date(e.date).toLocaleDateString()} · {groupName(e.groupId)} ·{' '}
                {e.category}
              </div>
            </div>
            <div className="font-medium">{formatMoney(e.amount, e.currency)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
