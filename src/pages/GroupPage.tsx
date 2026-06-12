import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Settings } from 'lucide-react'
import { useGroups, useGroupData } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import { computeBalances, simplifyDebts, type NetMap } from '../lib/balances'
import { monthKey } from '../lib/forecast'
import { formatMoney } from '../lib/money'
import { formatDate, monthYearLabel } from '../lib/date'
import { SettleUpDialog } from '../components/SettleUpDialog'
import type { AmountMap, Expense } from '../types'

export function GroupPage() {
  const { groupId } = useParams()
  const { groups } = useGroups()
  const group = groups.find((g) => g.id === groupId)
  const { expenses, settlements, balances } = useGroupData(groupId)
  const { user } = useAuth()

  const [showSettle, setShowSettle] = useState(false)

  const nameOf = (uid: string) =>
    group?.members[uid]?.displayName ?? (uid === user?.uid ? 'You' : uid.slice(0, 6))

  const thisMonth = monthKey(Date.now())
  // Per-currency balances restricted to the current month.
  const monthBalances = useMemo(
    () =>
      computeBalances(
        expenses.filter((e) => monthKey(e.date) === thisMonth),
        settlements.filter((s) => monthKey(s.date) === thisMonth),
      ),
    [expenses, settlements, thisMonth],
  )

  if (!group) {
    return <p className="text-slate-400">Loading group…</p>
  }

  const visibleExpenses = expenses.filter((e) => !e.deleted)
  // Group the (already date-desc) list into month sections, with per-currency totals.
  const monthGroups: { label: string; items: Expense[]; total: AmountMap }[] = []
  for (const e of visibleExpenses) {
    const label = monthYearLabel(e.date)
    const last = monthGroups[monthGroups.length - 1]
    const bucket =
      last && last.label === label
        ? last
        : (monthGroups.push({ label, items: [], total: {} }),
          monthGroups[monthGroups.length - 1])
    bucket.items.push(e)
    bucket.total[e.currency] = (bucket.total[e.currency] ?? 0) + e.amount
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-slate-400">
          <ArrowLeft size={20} />
        </Link>
        {group.photoURL && (
          <img
            src={group.photoURL}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        )}
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
            monthNet={(monthBalances[currency] ?? {}) as NetMap}
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
            <div className="flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>{grp.label}</span>
              <span className="space-x-2">
                {Object.entries(grp.total).map(([cur, amt]) => (
                  <span key={cur}>{formatMoney(amt, cur)}</span>
                ))}
              </span>
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
  monthNet,
  simplify,
  nameOf,
}: {
  currency: string
  net: NetMap
  monthNet: NetMap
  simplify: boolean
  nameOf: (uid: string) => string
}) {
  const debts = useMemo(() => simplifyDebts(net, currency), [net, currency])
  // `simplify` off => show each person's raw net instead of minimized transfers.
  const rawNets = Object.entries(net).filter(([, v]) => v !== 0)
  // Everyone who has any all-time or this-month position.
  const people = Array.from(
    new Set([...Object.keys(net), ...Object.keys(monthNet)]),
  ).filter((uid) => (net[uid] ?? 0) !== 0 || (monthNet[uid] ?? 0) !== 0)

  const tone = (v: number) =>
    v > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : v < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-400'
  const fmtNet = (v: number) =>
    v === 0 ? '—' : `${v > 0 ? '+' : '−'}${formatMoney(Math.abs(v), currency)}`

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

      {/* Per-person: all-time vs this month */}
      {people.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-zinc-700">
          <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>Person</span>
            <span className="flex gap-4">
              <span className="w-24 text-right">All time</span>
              <span className="w-24 text-right">This month</span>
            </span>
          </div>
          {people.map((uid) => (
            <div key={uid} className="flex justify-between text-sm">
              <span className="truncate">{nameOf(uid)}</span>
              <span className="flex gap-4">
                <span className={`w-24 text-right ${tone(net[uid] ?? 0)}`}>
                  {fmtNet(net[uid] ?? 0)}
                </span>
                <span className={`w-24 text-right ${tone(monthNet[uid] ?? 0)}`}>
                  {fmtNet(monthNet[uid] ?? 0)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
