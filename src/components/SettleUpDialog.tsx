import { useState } from 'react'
import type { CurrencyBalances } from '../lib/balances'
import type { Group } from '../types'
import { toMinor } from '../lib/money'
import { addSettlement } from '../lib/firestore'
import { useAuth } from '../hooks/useAuth'
import { Modal } from './Modal'

export function SettleUpDialog({
  open,
  onClose,
  group,
  balances,
}: {
  open: boolean
  onClose: () => void
  group: Group
  balances: CurrencyBalances
}) {
  const { user } = useAuth()
  const members = group.memberUids
  const currencies = Object.keys(balances)
  const [from, setFrom] = useState(user?.uid ?? members[0])
  const [to, setTo] = useState(members.find((m) => m !== user?.uid) ?? members[0])
  const [currency, setCurrency] = useState(currencies[0] ?? group.defaultCurrency)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!user || from === to || !amount) return
    setBusy(true)
    try {
      await addSettlement(group.id, {
        from,
        to,
        amount: toMinor(amount, currency),
        currency,
        fxRate: 1,
        date: Date.now(),
        note: '',
        createdBy: user.uid,
      })
      setAmount('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (uid: string) => group.members[uid]?.displayName ?? uid.slice(0, 6)

  return (
    <Modal open={open} onClose={onClose} title="Settle up">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          >
            {members.map((m) => (
              <option key={m} value={m}>
                {nameOf(m)}
              </option>
            ))}
          </select>
          <span className="text-slate-400">pays</span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          >
            {members.map((m) => (
              <option key={m} value={m}>
                {nameOf(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          >
            {(currencies.length ? currencies : [group.defaultCurrency]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {from === to && (
          <p className="text-sm text-red-600">Payer and payee must differ.</p>
        )}
        <button
          type="button"
          disabled={busy || from === to || !amount}
          onClick={() => void submit()}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
        >
          Record payment
        </button>
      </div>
    </Modal>
  )
}
