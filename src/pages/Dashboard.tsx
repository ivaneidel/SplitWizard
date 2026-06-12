import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import { createGroup } from '../lib/firestore'
import { Modal } from '../components/Modal'
import type { Group } from '../types'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU']
const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800'

function GroupRow({ g }: { g: Group }) {
  return (
    <Link
      to={`/groups/${g.id}`}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        <Users size={18} />
      </span>
      <span className="flex-1">
        <span className="block font-medium">{g.name}</span>
        <span className="block text-sm text-slate-400">
          {g.memberUids.length} member{g.memberUids.length > 1 ? 's' : ''} ·{' '}
          {g.defaultCurrency}
        </span>
      </span>
    </Link>
  )
}

export function Dashboard() {
  const { groups, loading } = useGroups()
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [busy, setBusy] = useState(false)

  const active = useMemo(() => groups.filter((g) => !g.archived), [groups])
  const archived = useMemo(() => groups.filter((g) => g.archived), [groups])

  const submit = async () => {
    if (!user || !profile || !name.trim()) return
    setBusy(true)
    try {
      await createGroup({
        name: name.trim(),
        type: 'group',
        memberUids: [user.uid],
        members: {
          [user.uid]: {
            displayName: profile.displayName,
            photoURL: profile.photoURL,
            role: 'owner',
          },
        },
        defaultCurrency: currency,
        simplifyDebts: true,
        createdBy: user.uid,
      })
      setName('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your groups</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading…</p>}
      {!loading && active.length === 0 && (
        <p className="text-slate-500">No groups yet. Create one to get started.</p>
      )}

      <ul className="space-y-2">
        {active.map((g) => (
          <li key={g.id}>
            <GroupRow g={g} />
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="text-sm text-slate-400"
          >
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2 opacity-70">
              {archived.map((g) => (
                <li key={g.id}>
                  <GroupRow g={g} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New group">
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (e.g. Roomies)"
            className={INPUT}
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={INPUT}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </Modal>
    </div>
  )
}
