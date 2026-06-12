import type { Expense, Settlement } from '../types'

export interface ActivityEntry {
  id: string
  kind: 'expense' | 'settle'
  /** Timestamp the action happened (createdAt, falling back to date). */
  when: number
  groupId: string
  currency: string
  amount: number
  /** Who performed the action (expense creator / settlement payer). */
  actorUid: string
  /** Settlement payee (settle only). */
  toUid?: string
  /** Expense description (expense only). */
  description?: string
  /** Signed-in user's net for this entry: + you lent/received, − you owe/paid. */
  youNet: number
}

/**
 * Merge a user's expenses and settlements into a single newest-first activity
 * feed. Pure — name resolution happens in the UI. Deleted expenses are skipped.
 */
export function buildActivity(
  expenses: Expense[],
  settlements: Settlement[],
  uid: string,
): ActivityEntry[] {
  const out: ActivityEntry[] = []

  for (const e of expenses) {
    if (e.deleted) continue
    out.push({
      id: e.id,
      kind: 'expense',
      when: e.createdAt || e.date,
      groupId: e.groupId,
      currency: e.currency,
      amount: e.amount,
      actorUid: e.createdBy,
      description: e.description,
      youNet: (e.paidBy[uid] ?? 0) - (e.splits[uid] ?? 0),
    })
  }

  for (const s of settlements) {
    out.push({
      id: s.id,
      kind: 'settle',
      when: s.createdAt || s.date,
      groupId: s.groupId,
      currency: s.currency,
      amount: s.amount,
      actorUid: s.from,
      toUid: s.to,
      youNet: s.to === uid ? s.amount : s.from === uid ? -s.amount : 0,
    })
  }

  return out.sort((a, b) => b.when - a.when)
}
