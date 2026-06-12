import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Settings } from 'lucide-react'
import { useGroups, useGroupData } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import { simplifyDebts, type NetMap } from '../lib/balances'
import { formatMoney } from '../lib/money'
import { formatDate, monthYearLabel } from '../lib/date'
import { SettleUpDialog } from '../components/SettleUpDialog'
import type { Expense } from '../types'

export function GroupPage() {
  const { groupId } = useParams()
  const { groups } = useGroups()
  const group = groups.find((g) => g.id === groupId)
  const { expenses, balances } = useGroupData(groupId)
  const { user } = useAuth()

  const [showSettle, setShowSettle] = useState(false)

  const nameOf = (uid: string) =>
    group?.members[uid]?.displayName ?? (uid === user?.uid ? 'You' : uid.slice(0, 6))

  if (!group) {
    return <p className="text-slate-400">Loading group…</p>
  }

  const visibleExpenses = expenses.filter((e) => !e.deleted)
  // Group the (already date-desc) list into month sections.
  const monthGroups: { label: string; items: Expense[] }[] = []
  for (const e of visibleExpenses) {
    const label = monthYearLabel(e.date)
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === label) last.items.push(e)
    else monthGroups.push({ label, items: [e] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-slate-400">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-xl font-bold">{group.name}</h1>
        <Link
          to={`/groups/${group.id}/settings`}
          className="text-slate-400"
          title="Group settings"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* Balances */}
      <section className="space-y-2">
        {Object.entries(balances).map(([currency, net]) => (
          <CurrencyBalanceCard
            key={currency}
            currency={currency}
            net={net as NetMap}
            simplify={group.simplifyDebts}
            nameOf={nameOf}
          />
        ))}
        {Object.keys(balances).length === 0 && (
          <p className="text-slate-400">All settled up.</p>
        )}
      </section>

      <div className="flex gap-2">
        <Link
          to={`/groups/${group.id}/add`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 font-medium text-white"
        >
          <Plus size={16} /> Add expense
        </Link>
        <button
          type="button"
          onClick={() => setShowSettle(true)}
          className="flex-1 rounded-lg border border-emerald-600 py-2 font-medium text-emerald-700 dark:text-emerald-400"
        >
          Settle up
        </button>
      </div>

      {/* Expense list, grouped by month */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Expenses
        </h2>
        {visibleExpenses.length === 0 && (
          <p className="text-slate-400">No expenses yet.</p>
        )}
        {monthGroups.map((grp) => (
          <div key={grp.label} className="space-y-1">
            <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {grp.label}
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
              {grp.items.map((e) => {
                const net =
                  (e.paidBy[user?.uid ?? ''] ?? 0) - (e.splits[user?.uid ?? ''] ?? 0)
                return (
                  <li key={e.id}>
                    <Link
                      to={`/groups/${group.id}/expenses/${e.id}/edit`}
                      className="flex items-center justify-between p-3 transition hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                    >
                      <div>
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-slate-400">
                          {formatDate(e.date)} · paid by{' '}
                          {Object.keys(e.paidBy).map(nameOf).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatMoney(e.amount, e.currency)}
                        </div>
                        {net !== 0 && (
                          <div
                            className={
                              net > 0
                                ? 'text-xs text-emerald-400 dark:text-emerald-300'
                                : 'text-xs text-rose-400 dark:text-rose-300'
                            }
                          >
                            {net > 0
                              ? `you lent ${formatMoney(net, e.currency)}`
                              : `lent to you ${formatMoney(-net, e.currency)}`}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <SettleUpDialog
        open={showSettle}
        onClose={() => setShowSettle(false)}
        group={group}
        balances={balances}
      />
    </div>
  )
}

function CurrencyBalanceCard({
  currency,
  net,
  simplify,
  nameOf,
}: {
  currency: string
  net: NetMap
  simplify: boolean
  nameOf: (uid: string) => string
}) {
  const debts = useMemo(() => simplifyDebts(net, currency), [net, currency])
  // `simplify` off => show each person's raw net instead of minimized transfers.
  const rawNets = Object.entries(net).filter(([, v]) => v !== 0)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
        {currency}
      </div>
      {debts.length === 0 ? (
        <p className="text-slate-400">Settled up.</p>
      ) : simplify ? (
        <ul className="space-y-1">
          {debts.map((d, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-red-600">{nameOf(d.from)}</span> owes{' '}
              <span className="font-medium text-emerald-600">{nameOf(d.to)}</span>{' '}
              {formatMoney(d.amount, currency)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1">
          {rawNets.map(([uid, v]) => (
            <li key={uid} className="text-sm">
              {nameOf(uid)}{' '}
              <span className={v > 0 ? 'text-emerald-600' : 'text-red-600'}>
                {v > 0 ? 'is owed' : 'owes'} {formatMoney(Math.abs(v), currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
