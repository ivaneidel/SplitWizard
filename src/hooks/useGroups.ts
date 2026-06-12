import { useEffect, useState } from 'react'
import type { Expense, Group, Settlement } from '../types'
import {
  watchGroupExpenses,
  watchGroupSettlements,
  watchUserGroups,
} from '../lib/firestore'
import { computeBalances, type CurrencyBalances } from '../lib/balances'
import { useAuth } from './useAuth'

/** Live list of the signed-in user's groups. */
export function useGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    return watchUserGroups(user.uid, (g) => {
      setGroups(g.sort((a, b) => b.createdAt - a.createdAt))
      setLoading(false)
    })
  }, [user])

  return { groups, loading }
}

/** Live expenses + settlements + derived balances for one group. */
export function useGroupData(groupId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balances, setBalances] = useState<CurrencyBalances>({})

  useEffect(() => {
    if (!groupId) return
    const unsubE = watchGroupExpenses(groupId, setExpenses)
    const unsubS = watchGroupSettlements(groupId, setSettlements)
    return () => {
      unsubE()
      unsubS()
    }
  }, [groupId])

  useEffect(() => {
    setBalances(computeBalances(expenses, settlements))
  }, [expenses, settlements])

  return { expenses, settlements, balances }
}
