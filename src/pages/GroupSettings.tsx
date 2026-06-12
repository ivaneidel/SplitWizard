import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, UserMinus, UserPlus, Users } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useAuth } from '../hooks/useAuth'
import {
  archiveGroup,
  claimGuest,
  deleteGroup,
  findUserByEmail,
  leaveGroup,
  removeMember,
  updateGroup,
} from '../lib/firestore'
import { addMemberByEmail, addPlaceholderMember } from '../lib/members'
import { compressImage } from '../lib/image'
import { cn } from '../lib/cn'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU']
const INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800'
const CARD =
  'rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800'

export function GroupSettings() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { groups } = useGroups()
  const { user } = useAuth()
  const group = groups.find((g) => g.id === groupId)

  const [email, setEmail] = useState('')
  const [guestMode, setGuestMode] = useState(false)
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
      if (guestMode) {
        await addPlaceholderMember(group, email)
        setEmail('')
      } else {
        const ok = await addMemberByEmail(group, email)
        if (!ok) setError('No user with that email has signed in yet.')
        else setEmail('')
      }
    } finally {
      setBusy(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      const photoURL = await compressImage(file)
      await updateGroup(group.id, { photoURL })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process image.')
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async (uid: string, name: string) => {
    if (!confirm(`Remove ${name} from “${group.name}”?`)) return
    await removeMember(group, uid)
  }

  const linkGuest = async (guestId: string) => {
    const e = window.prompt('Email of the account to link to this guest:')
    if (!e) return
    const found = await findUserByEmail(e)
    if (!found) {
      alert('No user with that email has signed in yet.')
      return
    }
    await claimGuest(group, guestId, found.uid, {
      displayName: found.displayName,
      photoURL: found.photoURL,
    })
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
        <div className="flex items-center gap-3">
          {group.photoURL ? (
            <img
              src={group.photoURL}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              <Users size={22} />
            </div>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <label className="cursor-pointer font-medium text-amber-600">
              {group.photoURL ? 'Change photo' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && void uploadPhoto(e.target.files[0])
                }
              />
            </label>
            {group.photoURL && (
              <button
                type="button"
                onClick={() => void updateGroup(group.id, { photoURL: '' })}
                className="text-left text-xs text-slate-400"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
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
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Members
        </h2>
        <ul className="space-y-1">
          {group.memberUids.map((uid) => {
            const m = group.members[uid]
            return (
              <li key={uid} className="flex items-center justify-between text-sm">
                <span>
                  {m?.displayName ?? uid.slice(0, 6)}
                  {uid === group.createdBy && (
                    <span className="ml-2 text-xs text-amber-600">owner</span>
                  )}
                  {m?.placeholder && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">
                      guest
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {m?.placeholder && (
                    <button
                      type="button"
                      onClick={() => void linkGuest(uid)}
                      className="flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1.5 text-xs font-medium text-amber-600 dark:border-amber-700"
                      title="Link to a real account"
                    >
                      <Link2 size={16} /> Link
                    </button>
                  )}
                  {isOwner && uid !== user.uid && (
                    <button
                      type="button"
                      onClick={() => void confirmRemove(uid, m?.displayName ?? 'this member')}
                      className="rounded-lg p-2 text-red-500"
                      title="Remove"
                    >
                      <UserMinus size={18} />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Add: app user (email) vs guest (name only) */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-zinc-700">
          {[
            { v: false, label: 'App user' },
            { v: true, label: 'Guest' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setGuestMode(o.v)}
              className={cn(
                'flex-1 rounded-md py-1 font-medium',
                guestMode === o.v
                  ? 'bg-white text-amber-700 shadow-sm dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-slate-500 dark:text-zinc-400',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={guestMode ? 'Guest name' : 'email@example.com'}
            className={`min-w-0 flex-1 ${INPUT}`}
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void addMember()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <UserPlus size={16} /> Add
          </button>
        </div>
        {guestMode && (
          <p className="text-xs text-slate-400">
            A guest holds balances but has no account. Link them to a real account
            later via the “Link” button.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Danger zone */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void archive()}
          className="w-full rounded-lg border border-slate-300 py-2 font-medium dark:border-zinc-600"
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
