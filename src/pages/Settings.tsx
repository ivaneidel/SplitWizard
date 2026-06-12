import { Link } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, type Theme } from '../hooks/useTheme'
import { updateProfile } from '../lib/firestore'
import { cn } from '../lib/cn'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU']
const THEMES: { key: Theme; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]
const CARD =
  'rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800'

export function Settings() {
  const { user, profile, signOut, patchProfile } = useAuth()
  const { theme, setTheme } = useTheme()

  const changeCurrency = (c: string) => {
    if (!user) return
    patchProfile({ defaultCurrency: c })
    void updateProfile(user.uid, { defaultCurrency: c })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {profile && (
        <div className={CARD}>
          <div className="font-medium">{profile.displayName}</div>
          <div className="text-sm text-slate-500 dark:text-zinc-400">
            {profile.email}
          </div>
        </div>
      )}

      {/* Theme */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Appearance
        </h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-zinc-700">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium',
                theme === t.key
                  ? 'bg-white text-amber-700 shadow-sm dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-slate-500 dark:text-zinc-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Default currency */}
      {profile && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Default currency
          </h2>
          <select
            value={profile.defaultCurrency}
            onChange={(e) => changeCurrency(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Data */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Data
        </h2>
        <Link
          to="/import"
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-medium dark:border-zinc-700"
        >
          <FileSpreadsheet size={18} /> Import / Export
        </Link>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-red-200 px-4 py-2 text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
      >
        Sign out
      </button>
    </div>
  )
}
