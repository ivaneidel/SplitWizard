import type { AmountMap, SplitMode } from '../types'
import { splitByWeights, splitEvenly } from './money'

export interface ItemizedLine {
  /** Minor units. */
  amount: number
  /** uids sharing this line equally. */
  sharedBy: string[]
}

export interface SplitInput {
  /** Total minor units to distribute. */
  amount: number
  /** uids participating (order is used for remainder distribution). */
  participants: string[]
  mode: SplitMode
  /** mode='exact': uid -> minor units (should sum to amount). */
  exact?: AmountMap
  /** mode='percent': uid -> percentage (0..100). */
  percent?: Record<string, number>
  /** mode='shares': uid -> share weight. */
  shares?: Record<string, number>
  /** mode='adjustment': uid -> extra minor units owed on top of an equal split. */
  adjustment?: AmountMap
  /** mode='itemized': line items. */
  items?: ItemizedLine[]
}

/**
 * Compute the per-user split map for an expense. The result ALWAYS sums exactly
 * to `amount` (remainder cents distributed deterministically).
 */
export function computeSplits(input: SplitInput): AmountMap {
  const { amount, participants, mode } = input

  switch (mode) {
    case 'equal': {
      const parts = splitEvenly(amount, participants.length)
      return zip(participants, parts)
    }

    case 'exact':
      return { ...(input.exact ?? {}) }

    case 'percent': {
      const weights = participants.map((u) => input.percent?.[u] ?? 0)
      return zip(participants, splitByWeights(amount, weights))
    }

    case 'shares': {
      const weights = participants.map((u) => input.shares?.[u] ?? 0)
      return zip(participants, splitByWeights(amount, weights))
    }

    case 'adjustment': {
      const adj = input.adjustment ?? {}
      const adjTotal = participants.reduce((s, u) => s + (adj[u] ?? 0), 0)
      const remainder = amount - adjTotal
      const equalParts = splitEvenly(remainder, participants.length)
      const map: AmountMap = {}
      participants.forEach((u, i) => {
        map[u] = equalParts[i] + (adj[u] ?? 0)
      })
      return map
    }

    case 'itemized': {
      const map: AmountMap = {}
      for (const u of participants) map[u] = 0
      for (const line of input.items ?? []) {
        const parts = splitEvenly(line.amount, line.sharedBy.length)
        line.sharedBy.forEach((u, i) => {
          map[u] = (map[u] ?? 0) + parts[i]
        })
      }
      return map
    }
  }
}

/** True when a split map sums exactly to the expense amount. */
export function splitsAreValid(amount: number, splits: AmountMap): boolean {
  const sum = Object.values(splits).reduce((a, b) => a + b, 0)
  return sum === amount
}

function zip(uids: string[], amounts: number[]): AmountMap {
  const map: AmountMap = {}
  uids.forEach((u, i) => {
    map[u] = amounts[i] ?? 0
  })
  return map
}
