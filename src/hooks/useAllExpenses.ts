import { useEffect, useState } from 'react'
import type { Expense } from '../types'
import { watchAllUserExpenses } from '../lib/firestore'
import { useAuth } from './useAuth'

/** Every expense across all of the user's groups (for search + forecast). */
export function useAllExpenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    return watchAllUserExpenses(user.uid, (e) => {
      setExpenses(e)
      setLoading(false)
    })
  }, [user])

  return { expenses, loading }
}
