import { useAuth } from '../hooks/useAuth'

export function Settings() {
  const { profile, signOut } = useAuth()
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>
      {profile && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="font-medium">{profile.displayName}</div>
          <div className="text-sm text-slate-500">{profile.email}</div>
          <div className="mt-2 text-sm text-slate-500">
            Default currency: {profile.defaultCurrency}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-red-200 px-4 py-2 text-red-600 transition hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  )
}
