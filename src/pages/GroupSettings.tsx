import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, UserMinus, UserPlus } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import {
  archiveGroup,
  deleteGroup,
  leaveGroup,
  removeMember,
  updateGroup,
} from '../lib/firestore'
import { addMemberByEmail } from '../lib/members'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU']
const INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800'
const CARD =
  'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800'

export function GroupSettings() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { groups } = useGroups()
  const { user } = useAuth()
  const group = groups.find((g) => g.id === groupId)

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!group || !user) return <p className="text-slate-400">Loading…</p>
  const isOwner = group.createdBy === user.uid

  const rename = (name: string) => void updateGroup(group.id, { name })
  const setCurrency = (c: string) => void updateGroup(group.id, { defaultCurrency: c })
  const toggleSimplify = () =>
    void updateGroup(group.id, { simplifyDebts: !group.simplifyDebts })

  const addMember = async () => {
    setError('')
    setBusy(true)
    try {
      const ok = await addMemberByEmail(group, email)
      if (!ok) setError('No user with that email has signed in yet.')
      else setEmail('')
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    await archiveGroup(group.id, !group.archived)
    navigate('/')
  }
  const leave = async () => {
    if (!confirm(`Leave “${group.name}”?`)) return
    await leaveGroup(group, user.uid)
    navigate('/')
  }
  const remove = async () => {
    if (!confirm(`Delete “${group.name}” and all its expenses? This cannot be undone.`))
      return
    await deleteGroup(group.id)
    navigate('/')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Group settings</h1>
      </div>

      {/* Edit */}
      <div className={`${CARD} space-y-3`}>
        <label className="block text-sm">
          Name
          <input
            defaultValue={group.name}
            onBlur={(e) => e.target.value.trim() && rename(e.target.value.trim())}
            className={`mt-1 w-full ${INPUT}`}
          />
        </label>
        <label className="block text-sm">
          Default currency
          <select
            value={group.defaultCurrency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`mt-1 w-full ${INPUT}`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">
          Simplify debts
          <input
            type="checkbox"
            checked={group.simplifyDebts}
            onChange={toggleSimplify}
          />
        </label>
      </div>

      {/* Members */}
      <div className={`${CARD} space-y-3`}>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Members
        </h2>
        <ul className="space-y-1">
          {group.memberUids.map((uid) => (
            <li key={uid} className="flex items-center justify-between text-sm">
              <span>
                {group.members[uid]?.displayName ?? uid.slice(0, 6)}
                {uid === group.createdBy && (
                  <span className="ml-2 text-xs text-emerald-600">owner</span>
                )}
              </span>
              {isOwner && uid !== user.uid && (
                <button
                  type="button"
                  onClick={() => void removeMember(group, uid)}
                  className="text-red-500"
                  title="Remove"
                >
                  <UserMinus size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className={`flex-1 ${INPUT}`}
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void addMember()}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <UserPlus size={16} /> Add
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Danger zone */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void archive()}
          className="w-full rounded-lg border border-slate-300 py-2 font-medium dark:border-slate-600"
        >
          {group.archived ? 'Unarchive group' : 'Archive group'}
        </button>
        {!isOwner && (
          <button
            type="button"
            onClick={() => void leave()}
            className="w-full rounded-lg border border-amber-300 py-2 font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400"
          >
            Leave group
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => void remove()}
            className="w-full rounded-lg border border-red-300 py-2 font-medium text-red-600 dark:border-red-800"
          >
            Delete group
          </button>
        )}
      </div>
    </div>
  )
}
