import { useEffect, useMemo, useState } from 'react'
import type { AmountMap, SplitMode } from '../types'
import { computeSplits } from '../lib/splits'
import { formatMoney, toMinor } from '../lib/money'
import { cn } from '../lib/cn'

const MODES: { key: SplitMode; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'Exact' },
  { key: 'percent', label: '%' },
  { key: 'shares', label: 'Shares' },
]

export function SplitEditor({
  amount,
  currency,
  participants,
  nameOf,
  onChange,
  initialMode = 'equal',
  initialRaw,
}: {
  amount: number // minor units
  currency: string
  participants: string[]
  nameOf: (uid: string) => string
  onChange: (splits: AmountMap, valid: boolean, mode: SplitMode) => void
  /** Initial split mode (e.g. 'exact' when editing an existing expense). */
  initialMode?: SplitMode
  /** Initial per-uid raw input values (major units for exact mode). */
  initialRaw?: Record<string, string>
}) {
  const [mode, setMode] = useState<SplitMode>(initialMode)
  // Raw text inputs per uid for exact/percent/shares.
  const [raw, setRaw] = useState<Record<string, string>>(initialRaw ?? {})

  const splits = useMemo<AmountMap>(() => {
    switch (mode) {
      case 'equal':
        return computeSplits({ amount, participants, mode })
      case 'exact':
        return computeSplits({
          amount,
          participants,
          mode,
          exact: mapNums(participants, raw, (v) => toMinor(v, currency)),
        })
      case 'percent':
        return computeSplits({
          amount,
          participants,
          mode,
          percent: mapNums(participants, raw, (v) => parseFloat(v) || 0),
        })
      case 'shares':
        return computeSplits({
          amount,
          participants,
          mode,
          shares: mapNums(participants, raw, (v) => parseFloat(v) || 0),
        })
      default:
        return {}
    }
  }, [mode, amount, participants, raw, currency])

  const total = Object.values(splits).reduce((a, b) => a + b, 0)
  const valid = total === amount && participants.length > 0

  useEffect(() => {
    onChange(splits, valid, mode)
  }, [splits, valid, mode, onChange])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-zinc-700">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium',
              mode === m.key
                ? 'bg-white text-indigo-700 shadow-sm dark:bg-zinc-800 dark:text-indigo-400'
                : 'text-slate-500 dark:text-zinc-400',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ul className="space-y-1">
        {participants.map((uid) => (
          <li key={uid} className="flex items-center justify-between gap-2">
            <span className="text-sm">{nameOf(uid)}</span>
            {mode === 'equal' ? (
              <span className="text-sm text-slate-500">
                {formatMoney(splits[uid] ?? 0, currency)}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={raw[uid] ?? ''}
                  onChange={(e) =>
                    setRaw((r) => ({ ...r, [uid]: e.target.value }))
                  }
                  placeholder={mode === 'percent' ? '%' : mode === 'shares' ? '1' : '0'}
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
                <span className="w-20 text-right text-xs text-slate-400">
                  {formatMoney(splits[uid] ?? 0, currency)}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'text-right text-sm',
          valid ? 'text-indigo-600' : 'text-red-600',
        )}
      >
        {formatMoney(total, currency)} / {formatMoney(amount, currency)}
        {!valid && ' — must match'}
      </div>
    </div>
  )
}

function mapNums(
  uids: string[],
  raw: Record<string, string>,
  parse: (v: string) => number,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const u of uids) out[u] = parse(raw[u] ?? '')
  return out
}
