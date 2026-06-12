import { useEffect, useState } from 'react'
import type { Budget } from '../types'
import { watchBudgets } from '../lib/firestore'
import { useAuth } from './useAuth'

export function useBudgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])

  useEffect(() => {
    if (!user) return
    return watchBudgets(user.uid, setBudgets)
  }, [user])

  return budgets
}
