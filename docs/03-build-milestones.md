# 03 — Build Milestones (v1)

The initial app was built in these milestones. All pure engines were unit-tested and the
production build verified at each step.

1. **Scaffold** — Vite + React + TS, Tailwind v4, React Router, Firebase init,
   vite-plugin-pwa, Google SSO + protected routes, user-profile bootstrap on first login.

2. **Core engines** (pure TS, Vitest) — `money`, `splits`, `balances` + `simplifyDebts`,
   `installments`, `fx`.

3. **Core ledger** — groups + add-member-by-email, add/edit/delete expense with all split
   modes (via `SplitEditor`), balances view, simplified "who owes whom", settle-up dialog;
   `firestore.rules` + collection-group index; **auto-installments wired into Add Expense**
   (toggle → N future-dated rows in one batch).

4. **Multi-currency** — per-expense FX rate capture; display conversion.

5. **Auto-installments + forecast dashboard** — `installmentPlans` doc, generate-all-upfront,
   edit/delete-as-group; **Installments page** with "due next month", per-plan progress,
   month-by-month timeline.

6. **Excel import/export + "Search all over"** — Splitwise import mapper with
   balance-preserving net reconstruction + preview; XLSX export; global client-side search.

7. **Charts + budgets** — category pie, monthly trend (Recharts), per-category caps.

8. **PWA + deploy** — icons/manifest, route-level code-splitting (Charts, ImportExport),
   Firebase Hosting.

> Verification at v1: 28 unit tests + 6 emulator rules tests green; `tsc` + production
> build clean.
