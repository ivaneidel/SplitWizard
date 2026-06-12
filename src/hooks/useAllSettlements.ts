import { useEffect, useState } from 'react'
import type { Settlement } from '../types'
import { watchAllUserSettlements } from '../lib/firestore'
import { useAuth } from './useAuth'

/** Every settlement involving the user across all groups (for Activity). */
export function useAllSettlements() {
  const { user } = useAuth()
  const [settlements, setSettlements] = useState<Settlement[]>([])

  useEffect(() => {
    if (!user) return
    return watchAllUserSettlements(user.uid, setSettlements)
  }, [user])

  return settlements
}
