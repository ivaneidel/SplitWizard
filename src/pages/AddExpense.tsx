import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useGroups, useGroupData } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import {
  addExpense,
  createInstallmentPlan,
  deleteExpense,
  updateExpense,
} from '../lib/firestore'
import { toMajor, toMinor } from '../lib/money'
import { SplitEditor } from '../components/SplitEditor'
import type { AmountMap, SplitMode } from '../types'

const CATEGORIES = [
  'general',
  'groceries',
  'rent',
  'utilities',
  'dining',
  'transport',
  'entertainment',
  'electronics',
  'travel',
  'health',
]

const INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800'

export function AddExpense() {
  const { groupId, expenseId } = useParams()
  const editing = Boolean(expenseId)
  const navigate = useNavigate()
  const { groups } = useGroups()
  const group = groups.find((g) => g.id === groupId)
  const { expenses } = useGroupData(groupId)
  const existing = editing ? expenses.find((e) => e.id === expenseId) : undefined
  const { user } = useAuth()

  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [category, setCategory] = useState('general')
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [payer, setPayer] = useState(user?.uid ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [splits, setSplits] = useState<AmountMap>({})
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [splitValid, setSplitValid] = useState(false)
  const [installments, setInstallments] = useState(false)
  const [count, setCount] = useState('10')
  const [busy, setBusy] = useState(false)

  // One-time form initialization once the group (and expense, when editing) load.
  const initRef = useRef(false)
  const [initialRaw, setInitialRaw] = useState<Record<string, string>>()
  useEffect(() => {
    if (initRef.current || !group) return
    if (editing && !existing) return
    initRef.current = true
    if (existing) {
      setDescription(existing.description)
      setAmountStr(String(toMajor(existing.amount, existing.currency)))
      setCurrency(existing.currency)
      setCategory(existing.category)
      setDateStr(new Date(existing.date).toISOString().slice(0, 10))
      setPayer(Object.keys(existing.paidBy)[0] ?? user?.uid ?? '')
      setSelected(new Set(Object.keys(existing.splits)))
      // Prefill the split editor in 'exact' mode with the stored amounts.
      const raw: Record<string, string> = {}
      for (const [uid, v] of Object.entries(existing.splits)) {
        raw[uid] = String(toMajor(v, existing.currency))
      }
      setInitialRaw(raw)
    } else {
      setCurrency(group.defaultCurrency)
      setPayer(user?.uid ?? group.memberUids[0])
      setSelected(new Set(group.memberUids))
    }
  }, [group, existing, editing, user])

  const amount = toMinor(amountStr || '0', currency)
  const participants = useMemo(() => [...selected], [selected])
  const nameOf = (uid: string) =>
    group?.members[uid]?.displayName ?? (uid === user?.uid ? 'You' : uid.slice(0, 6))

  if (!group) return <p className="text-slate-400">Loading…</p>

  const canSubmit =
    description.trim() && amount > 0 && splitValid && payer && !busy

  const submit = async () => {
    if (!user || !canSubmit) return
    setBusy(true)
    try {
      const date = Date.parse(dateStr)
      const paidBy: AmountMap = { [payer]: amount }
      const participantUids = Array.from(
        new Set([...Object.keys(paidBy), ...Object.keys(splits)]),
      )
      if (editing && existing) {
        await updateExpense(group.id, existing.id, {
          description: description.trim(),
          amount,
          currency,
          category,
          date,
          splitMode,
          paidBy,
          splits,
          participantUids,
        })
      } else if (installments) {
        const n = Math.max(2, parseInt(count, 10) || 2)
        await createInstallmentPlan(
          group.id,
          {
            baseDescription: description.trim(),
            totalAmount: amount,
            count: n,
            dayOfMonth: new Date(date).getUTCDate(),
            startDate: date,
            currency,
            category,
            paidBy,
            splits,
          },
          user.uid,
        )
      } else {
        await addExpense(group.id, {
          description: description.trim(),
          amount,
          currency,
          fxRate: 1,
          category,
          date,
          splitMode,
          paidBy,
          splits,
          participantUids,
          createdBy: user.uid,
        })
      }
      navigate(`/groups/${group.id}`)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!existing) return
    if (!confirm('Delete this expense?')) return
    setBusy(true)
    try {
      await deleteExpense(group.id, existing.id)
      navigate(`/groups/${group.id}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleMember = (uid: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-xl font-bold">
          {editing ? 'Edit expense' : 'Add expense'}
        </h1>
        {editing && (
          <button type="button" onClick={() => void onDelete()} className="text-red-500">
            <Trash2 size={20} />
          </button>
        )}
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className={`w-full ${INPUT}`}
      />

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.00"
          className={`flex-1 ${INPUT}`}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={INPUT}
        >
          {[group.defaultCurrency, 'USD', 'EUR', 'ARS', 'BRL']
            .filter((c, i, a) => a.indexOf(c) === i)
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`flex-1 capitalize ${INPUT}`}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className={INPUT}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        Paid by
        <select
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          className={`flex-1 ${INPUT}`}
        >
          {group.memberUids.map((m) => (
            <option key={m} value={m}>
              {nameOf(m)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Split between
        </div>
        <div className="flex flex-wrap gap-2">
          {group.memberUids.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMember(m)}
              className={
                selected.has(m)
                  ? 'rounded-full bg-emerald-600 px-3 py-1 text-sm text-white'
                  : 'rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400'
              }
            >
              {nameOf(m)}
            </button>
          ))}
        </div>
      </div>

      {amount > 0 && participants.length > 0 && (
        <SplitEditor
          amount={amount}
          currency={currency}
          participants={participants}
          nameOf={nameOf}
          initialMode={existing ? 'exact' : 'equal'}
          initialRaw={initialRaw}
          onChange={(s, valid, mode) => {
            setSplits(s)
            setSplitValid(valid)
            setSplitMode(mode)
          }}
        />
      )}

      {!editing && (
        <>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={installments}
              onChange={(e) => setInstallments(e.target.checked)}
            />
            <span className="text-sm">Split into monthly installments</span>
            {installments && (
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="ml-auto w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            )}
          </label>
          {installments && (
            <p className="text-xs text-slate-400">
              Creates {count}× expenses named “{description || 'X'} 1/{count}” … on
              day {new Date(Date.parse(dateStr)).getUTCDate()} of each month. The
              amount above is the TOTAL.
            </p>
          )}
        </>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white disabled:opacity-50"
      >
        {editing
          ? 'Save changes'
          : installments
            ? `Create ${count} installments`
            : 'Save expense'}
      </button>
    </div>
  )
}
