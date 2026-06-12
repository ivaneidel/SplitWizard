import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    // Returning user: render optimistically (pages show skeletons, data hydrates
    // from the offline cache the moment auth resolves) instead of a blank gate.
    if (localStorage.getItem('hadSession')) return <>{children}</>
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
