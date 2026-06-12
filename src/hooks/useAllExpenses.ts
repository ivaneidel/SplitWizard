import { useEffect, useMemo, useState } from 'react'
import type { Expense } from '../types'
import { watchGroupExpenses } from '../lib/firestore'
import { useAuth } from './useAuth'
import { useGroups } from './useGroups'

/**
 * Every expense across all of the user's groups (dashboard totals + search +
 * forecast + charts + activity).
 *
 * We fan out one direct subcollection listener per group instead of a single
 * `collectionGroup('expenses')` query: with Firestore's persistent local cache,
 * a collection-group listener only surfaces docs from subcollections that a
 * *direct* listener has already primed, so the dashboard's "This month" total
 * stayed stale until you opened each group. Per-group listeners always sync
 * fully from the server, so totals stay fresh without visiting every group.
 */
export function useAllExpenses() {
  const { user } = useAuth()
  const { groups, loading: groupsLoading } = useGroups()
  const [byGroup, setByGroup] = useState<Record<string, Expense[]>>({})

  const groupIds = groups.map((g) => g.id)
  const groupKey = groupIds.join(',')

  useEffect(() => {
    if (!user) return
    // Drop any groups the user is no longer in before (re)subscribing.
    setByGroup((prev) => {
      const next: Record<string, Expense[]> = {}
      for (const id of groupIds) if (prev[id]) next[id] = prev[id]
      return next
    })
    const unsubs = groupIds.map((id) =>
      watchGroupExpenses(id, (exps) =>
        setByGroup((prev) => ({ ...prev, [id]: exps })),
      ),
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, groupKey])

  const expenses = useMemo(() => {
    if (!user) return []
    return Object.values(byGroup)
      .flat()
      .filter((e) => e.participantUids?.includes(user.uid))
  }, [byGroup, user])

  // Still loading until the group list resolves and every group has reported once.
  const loading =
    groupsLoading || Object.keys(byGroup).length < groupIds.length

  return { expenses, loading }
}
