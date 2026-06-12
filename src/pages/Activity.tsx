import { useMemo } from 'react'
import { ArrowLeftRight, Receipt } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useAllSettlements } from '../hooks/useAllSettlements'
import { useGroups } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import { buildActivity, type ActivityEntry } from '../lib/activity'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/date'

export function Activity() {
  const { expenses, loading } = useAllExpenses()
  const settlements = useAllSettlements()
  const { groups } = useGroups()
  const { user } = useAuth()

  const nameByUid = useMemo(() => {
    const m: Record<string, string> = {}
    for (const g of groups)
      for (const [uid, mem] of Object.entries(g.members)) m[uid] = mem.displayName
    return m
  }, [groups])
  const nameOf = (uid: string) =>
    uid === user?.uid ? 'You' : (nameByUid[uid] ?? uid.slice(0, 6))
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? 'a group'

  const entries = useMemo(
    () => (user ? buildActivity(expenses, settlements, user.uid) : []),
    [expenses, settlements, user],
  )

  // Group consecutive (newest-first) entries by calendar day.
  const days: { day: string; items: ActivityEntry[] }[] = []
  for (const e of entries) {
    const day = formatDate(e.when)
    const last = days[days.length - 1]
    if (last && last.day === day) last.items.push(e)
    else days.push({ day, items: [e] })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Activity</h1>
      {loading && <p className="text-slate-400">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-slate-500">No activity yet.</p>
      )}

      {days.map((d) => (
        <section key={d.day} className="space-y-1">
          <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {d.day}
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
            {d.items.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">
                  {e.kind === 'expense' ? (
                    <Receipt size={16} />
                  ) : (
                    <ArrowLeftRight size={16} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {e.kind === 'expense' ? (
                      <>
                        <span className="font-medium">{nameOf(e.actorUid)}</span> added “
                        {e.description}”
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{nameOf(e.actorUid)}</span> paid{' '}
                        <span className="font-medium">{nameOf(e.toUid ?? '')}</span>
                      </>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {groupName(e.groupId)} · {formatMoney(e.amount, e.currency)}
                  </div>
                </div>
                {e.youNet !== 0 && (
                  <span
                    className={
                      e.youNet > 0
                        ? 'shrink-0 text-xs text-emerald-400 dark:text-emerald-300'
                        : 'shrink-0 text-xs text-rose-400 dark:text-rose-300'
                    }
                  >
                    {e.youNet > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(e.youNet), e.currency)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
