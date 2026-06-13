import { NavLink, useLocation, useOutlet } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  PieChart,
  Search,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useT } from "../i18n";

const NAV = [
  { to: "/", key: "nav.home", icon: LayoutDashboard, end: true },
  { to: "/installments", key: "nav.plans", icon: CalendarClock },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/charts", key: "nav.charts", icon: PieChart },
  { to: "/activity", key: "nav.activity", icon: Activity },
];

export function AppLayout() {
  const { profile } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
        <NavLink to="/" className="font-bold text-indigo-600">
          SplitWizard
        </NavLink>
        {profile && (
          <NavLink
            to="/settings"
            className="text-sm text-slate-500 dark:text-zinc-400"
          >
            {profile.displayName}
          </NavLink>
        )}
      </header>

      <main className="flex flex-1 overflow-y-auto p-4 pb-24">
        <div
          key={location.pathname}
          className="page-transition flex min-w-full items-stretch flex-col"
        >
          {outlet}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl justify-around border-t border-slate-200 bg-white py-2 dark:border-zinc-700 dark:bg-zinc-800">
        {NAV.map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive ? "text-indigo-600" : "text-slate-400"
              }`
            }
          >
            <Icon size={20} />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
