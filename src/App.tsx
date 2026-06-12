import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { GroupPage } from './pages/GroupPage'
import { GroupSettings } from './pages/GroupSettings'
import { AddExpense } from './pages/AddExpense'
import { Installments } from './pages/Installments'
import { Search } from './pages/Search'
import { Activity } from './pages/Activity'
import { Settings } from './pages/Settings'

// Heavy deps (recharts, xlsx) are code-split so they don't bloat the initial load.
const Charts = lazy(() => import('./pages/Charts').then((m) => ({ default: m.Charts })))
const ImportExport = lazy(() =>
  import('./pages/ImportExport').then((m) => ({ default: m.ImportExport })),
)

const Loading = () => (
  <div className="p-8 text-center text-slate-400">Loading…</div>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/groups/:groupId" element={<GroupPage />} />
        <Route path="/groups/:groupId/settings" element={<GroupSettings />} />
        <Route path="/groups/:groupId/add" element={<AddExpense />} />
        <Route
          path="/groups/:groupId/expenses/:expenseId/edit"
          element={<AddExpense />}
        />
        <Route path="/installments" element={<Installments />} />
        <Route path="/search" element={<Search />} />
        <Route path="/activity" element={<Activity />} />
        <Route
          path="/charts"
          element={
            <Suspense fallback={<Loading />}>
              <Charts />
            </Suspense>
          }
        />
        <Route
          path="/import"
          element={
            <Suspense fallback={<Loading />}>
              <ImportExport />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
