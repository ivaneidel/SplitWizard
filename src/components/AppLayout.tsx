import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarClock,
  FileSpreadsheet,
  LayoutDashboard,
  PieChart,
  Search,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/installments', label: 'Plans', icon: CalendarClock },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/charts', label: 'Charts', icon: PieChart },
  { to: '/import', label: 'Import', icon: FileSpreadsheet },
]

export function AppLayout() {
  const { profile } = useAuth()
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
        <NavLink to="/" className="font-bold text-emerald-600">
          SplitWizard
        </NavLink>
        {profile && (
          <NavLink to="/settings" className="text-sm text-slate-500 dark:text-zinc-400">
            {profile.displayName}
          </NavLink>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl justify-around border-t border-slate-200 bg-white py-2 dark:border-zinc-700 dark:bg-zinc-800">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive ? 'text-emerald-600' : 'text-slate-400'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
