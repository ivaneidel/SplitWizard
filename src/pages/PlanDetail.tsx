import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Search, Trash2, Unlink } from 'lucide-react'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useGroups } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import {
  bulkEditInstallmentPlan,
  deleteInstallmentPlan,
  linkExpenseToPlan,
  unlinkExpenseFromPlan,
  updateInstallmentPlan,
} from '../lib/firestore'
import { amountsDrift, redistributeInstallments } from '../lib/installments'
import { formatMoney, toMajor, toMinor } from '../lib/money'
import { formatDate } from '../lib/date'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import type { Expense } from '../types'

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800'

/** Strip a trailing " i/M" from an installment description. */
const baseOf = (desc: string) => desc.replace(/\s+\d+\/\d+$/, '')
/** Parse the declared length M from a "… i/M" description. */
const declaredCount = (desc: string) => {
  const m = desc.match(/\s+(\d+)\/(\d+)$/)
  return m ? Number(m[2]) : 0
}
const indexOf = (e: Expense) => {
  if (typeof e.installmentIndex === 'number') return e.installmentIndex
  const m = e.description.match(/\s+(\d+)\/\d+$/)
  return m ? Number(m[1]) : 0
}

export function PlanDetail() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const { expenses, loading } = useAllExpenses()
  const { groups } = useGroups()
  const { user } = useAuth()
  const now = Date.now()

  const [picking, setPicking] = useState(false)
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const rows = useMemo(
    () =>
      expenses
        .filter((e) => e.installmentPlanId === planId && !e.deleted)
        .sort((a, b) => a.date - b.date || indexOf(a) - indexOf(b)),
    [expenses, planId],
  )

  const groupId = rows[0]?.groupId
  const group = groups.find((g) => g.id === groupId)

  // Unlinked expenses in the same group, eligible to fold into the plan.
  const candidates = useMemo(() => {
    if (!groupId) return []
    const q = filter.trim().toLowerCase()
    return expenses
      .filter(
        (e) =>
          e.groupId === groupId &&
          !e.installmentPlanId &&
          !e.deleted &&
          (!q || e.description.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.date - a.date)
  }, [expenses, groupId, filter])

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <Link to="/installments" className="inline-flex items-center gap-1 text-slate-400">
          <ArrowLeft size={20} /> Installments
        </Link>
        <p className="text-slate-400">Plan not found.</p>
      </div>
    )
  }

  const base = baseOf(rows[0].description)
  const paid = rows.filter((r) => r.date <= now).length
  const declared = Math.max(...rows.map((r) => declaredCount(r.description)), rows.length)
  const next = rows.find((r) => r.date > now)
  // Total per currency across the plan's rows.
  const totalByCurrency = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] ?? 0) + r.amount
    return acc
  }, {})

  const persistTotal = (planRows: Expense[]) => {
    const total = planRows.reduce((s, r) => s + r.amount, 0)
    // Non-critical (display derives from rows); best-effort so a stricter rule on
    // the plan doc can't surface as an unhandled rejection.
    void updateInstallmentPlan(planId!, { totalAmount: total }).catch(() => {})
  }

  // Writes are fired without awaiting: offline, a Firestore write promise only
  // resolves on server ack, but the local cache write applies synchronously and
  // the live listener refreshes `rows` immediately. Awaiting would freeze the UI.
  const link = (e: Expense) => {
    if (!groupId) return
    const idx = indexOf(e) || Math.max(0, ...rows.map(indexOf)) + 1
    linkExpenseToPlan(groupId, e.id, planId!, idx).catch((err) =>
      console.error('Failed to link expense to plan', err),
    )
    persistTotal([...rows, e])
    setPicking(false)
    setFilter('')
  }

  const unlink = (e: Expense) => {
    if (!groupId) return
    unlinkExpenseFromPlan(groupId, e.id).catch((err) =>
      console.error('Failed to unlink expense', err),
    )
    persistTotal(rows.filter((r) => r.id !== e.id))
  }

  const currency = rows[0].currency
  const total = totalByCurrency[currency] ?? 0
  const drift = amountsDrift(rows)

  const openEdit = () => {
    setEditDesc(base)
    setEditAmount(String(toMajor(total, currency)))
    setEditing(true)
  }

  const saveEdit = () => {
    if (!groupId) return
    const desc = editDesc.trim()
    const newTotal = toMinor(editAmount || '0', currency)
    if (!desc || newTotal <= 0) return
    const updates = redistributeInstallments(rows, newTotal, desc)
    bulkEditInstallmentPlan(groupId, planId!, updates, {
      baseDescription: desc,
      totalAmount: newTotal,
    }).catch((err) => console.error('Failed to edit plan', err))
    setEditing(false)
  }

  const removePlan = () => {
    if (!groupId) return
    if (!confirm('Delete this plan and all its installments?')) return
    deleteInstallmentPlan(groupId, planId!).catch((err) =>
      console.error('Failed to delete plan', err),
    )
    navigate('/installments')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/installments" className="text-slate-400">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 truncate text-xl font-bold">{base}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openEdit}
            title="Edit plan"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-zinc-700"
          >
            <Pencil size={22} />
          </button>
          <button
            type="button"
            onClick={removePlan}
            title="Delete plan"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-zinc-700"
          >
            <Trash2 size={22} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            {group?.name}
          </span>
          <span className="text-sm font-medium">
            {paid}/{rows.length} paid
          </span>
        </div>
        <div className="mt-2 space-x-2 text-lg font-bold">
          {Object.entries(totalByCurrency).map(([cur, amt]) => (
            <span key={cur}>{formatMoney(amt, cur)}</span>
          ))}
        </div>
        {next && (
          <div className="mt-1 text-xs text-slate-400">
            Next: {formatDate(next.date)}
          </div>
        )}
      </div>

      {/* Missing-row hint */}
      {rows.length < declared && (
        <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
          You have {rows.length} of {declared} installments —{' '}
          {declared - rows.length} may be missing. Use “Add missing installment”
          below to fold it in.
        </div>
      )}

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-indigo-600 py-2 font-medium text-indigo-700 dark:text-indigo-400"
      >
        <Plus size={16} /> Add missing installment
      </button>

      {/* Installments */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Installments
        </h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center">
              <Link
                to={`/groups/${e.groupId}/expenses/${e.id}/edit`}
                className="flex flex-1 items-center justify-between p-3 transition hover:bg-slate-50 dark:hover:bg-zinc-700/50"
              >
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-xs text-slate-400">{formatDate(e.date)}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatMoney(e.amount, e.currency)}</div>
                  <div className="text-xs text-slate-400">
                    your share {formatMoney(e.splits[user?.uid ?? ''] ?? 0, e.currency)}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => void unlink(e)}
                title="Remove from plan"
                className="px-3 text-slate-400 hover:text-rose-500 disabled:opacity-50"
              >
                <Unlink size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Edit per row uses the existing expense edit screen */}
      <p className="text-xs text-slate-400">
        Tap an installment to edit it, or unlink to make it standalone again.
      </p>

      <Modal
        open={picking}
        onClose={() => {
          setPicking(false)
          setFilter('')
        }}
        title={`Add to ${base}`}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 dark:border-zinc-600">
            <Search size={16} className="text-slate-400" />
            <input
              value={filter}
              onChange={(ev) => setFilter(ev.target.value)}
              placeholder="Filter expenses…"
              className="w-full bg-transparent py-2 outline-none"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No unlinked expenses in this group.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-zinc-700 dark:border-zinc-700">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => void link(e)}
                    className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                  >
                    <div>
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-slate-400">{formatDate(e.date)}</div>
                    </div>
                    <div className="font-medium">{formatMoney(e.amount, e.currency)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit plan">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-zinc-400">Description</span>
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-zinc-400">
              Total amount ({currency})
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="0.00"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <p className="text-xs text-slate-400">
            Split evenly across {rows.length} installment
            {rows.length > 1 ? 's' : ''}; the “… i/{declared}” numbering is kept.
          </p>
          {drift && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Heads up: these installments aren’t all equal (e.g.{' '}
              {formatMoney(Math.max(...rows.map((r) => r.amount)), currency)} vs{' '}
              {formatMoney(Math.min(...rows.map((r) => r.amount)), currency)}). Saving
              will make them all equal. Continue only if that’s what you want.
            </div>
          )}
          <button
            type="button"
            disabled={!editDesc.trim() || toMinor(editAmount || '0', currency) <= 0}
            onClick={saveEdit}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </Modal>
    </div>
  )
}
