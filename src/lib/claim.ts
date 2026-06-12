import type { AmountMap } from '../types'

/**
 * Return a copy of `map` with `fromId` renamed to `toId`. If `toId` already
 * exists, the two entries are SUMMED (handles a guest and the real user both
 * appearing on the same expense).
 */
export function remapKey(
  map: AmountMap,
  fromId: string,
  toId: string,
): AmountMap {
  const out: AmountMap = {}
  for (const [k, v] of Object.entries(map)) {
    const key = k === fromId ? toId : k
    out[key] = (out[key] ?? 0) + v
  }
  return out
}

/** Rename `fromId`→`toId` in an id list, de-duplicated. */
export function remapList(uids: string[], fromId: string, toId: string): string[] {
  return Array.from(new Set(uids.map((u) => (u === fromId ? toId : u))))
}
