# 02 — Architecture

## Stack
- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`) + `lucide-react` icons
- **React Router v7**; Firestore `onSnapshot` via thin hooks (no TanStack Query)
- **Firebase SDK v12**: `firebase/auth`, `firebase/firestore` (persistent IndexedDB
  cache, multi-tab), `firebase/storage`
- **vite-plugin-pwa** (Workbox) — installable, offline app shell
- **SheetJS (`xlsx`)** — installed from the SheetJS CDN tarball, not npm, to avoid the
  unpatched-advisory npm versions
- **Recharts** (charts), **Zustand** available for UI state
- **Vitest** (+ jsdom) for unit tests; `@firebase/rules-unit-testing` for rules tests

## Project layout
```
src/
  lib/        money, splits, balances, installments, fx, excel, forecast, analytics,
              claim, installmentDetect, date, members, firestore (data access), firebase (init)
  hooks/      useAuth, useTheme, useGroups/useGroupData, useAllExpenses, useBudgets
  pages/      Login, Dashboard, GroupPage, GroupSettings, AddExpense, Installments,
              Search, Charts, ImportExport, Settings
  components/ AppLayout, ProtectedRoute, Modal, SplitEditor, SettleUpDialog
firestore.rules  firestore.indexes.json  storage.rules  firebase.json
```

## Pure, framework-free engines (`src/lib/`, unit-tested)
- `money.ts` — minor-unit parse/format; `splitEvenly` / `splitByWeights` distribute
  remainder cents so splits always sum exactly to the total.
- `splits.ts` — `computeSplits` for every split mode; always sums to the amount.
- `balances.ts` — fold expenses + settlements → **net per user per currency** (zero-sum);
  `simplifyDebts` greedy min-cash-flow; `estimatedNetTotal` for a cross-currency summary.
- `installments.ts` — `generateInstallments` (month-stepping with day clamping, e.g.
  Jan 31 → Feb 28; each installment internally balanced; amounts sum to the total).
- `fx.ts` — pure conversion + day-cached rates from a free no-key endpoint
  (`open.er-api.com`, supports ARS).
- `excel.ts` — parse Splitwise CSV/XLSX (positional fixed columns, any language) and
  **reconstruct balance-preserving expenses** from net-per-person columns; export.
- `installmentDetect.ts` — infer installment plans from imported `X N/M` series.
- `claim.ts` — `remapKey`/`remapList` for relinking a guest id to a real uid.
- `forecast.ts` / `analytics.ts` — month forecast & per-plan progress; category/month spend.
- `date.ts` — `formatDate` (YYYY-MM-DD, UTC) + `monthYearLabel`.

## Data model (Firestore)
- `users/{uid}` — `displayName, email, photoURL, defaultCurrency, paymentAliases`
- `groups/{groupId}` — `name, type, memberUids[], members{uid:{displayName,photoURL,role,placeholder?}},
  defaultCurrency, simplifyDebts, archived?, createdBy, createdAt`
- `groups/{groupId}/expenses/{id}` — `description, amount(minor), currency, fxRate,
  category, date, splitMode, paidBy{}, splits{}, participantUids[], createdBy, createdAt,
  updatedAt, installmentPlanId?, installmentIndex?, receiptUrl?, tags?, deleted?`
- `groups/{groupId}/settlements/{id}` — `from, to, amount, currency, fxRate, date, note`
- `groups/{groupId}/expenses/{id}/comments`, `groups/{groupId}/activity` (modeled)
- `installmentPlans/{id}` — `groupId, baseDescription, totalAmount, count, dayOfMonth,
  startDate, openEnded, currency, category, paidBy, splits, createdBy`
- `budgets/{uid}/categories/{category}` — `monthlyCap(minor), currency`

`participantUids[]` is denormalized so a **collection-group query** can fetch all of a
user's expenses across groups (global search, forecast, charts).

## Security rules (`firestore.rules`)
- `users/{uid}`: any signed-in user can read; only the owner can write.
- `groups/{groupId}` + all subcollections: read/write only if
  `request.auth.uid in group.memberUids` (membership-gated).
- `installmentPlans`: gated on membership of the referenced group.
- `budgets/{uid}`: owner only.
- Storage `receipts/{uid}/**`: signed-in read, owner write.
- Guest (`local_*`) ids never authenticate, so they grant no access.

## Money & balances rules
- All amounts are **integer minor units**. Zero-decimal currencies (JPY, CLP, …) handled.
- Balances are computed **per currency** as an exact zero-sum; the only cross-currency
  number is an optional "estimated total" using current rates — never used for settle-up.

## Testing & local backend
- `npm test` — Vitest unit tests for all pure engines (balances net to zero, splits sum
  to total, installments reconstruct totals, FX round-trips, Excel reconstruction,
  installment detection, date formatting, claim remapping).
- `npm run test:rules` — boots the **Firestore emulator** via `firebase emulators:exec`
  and runs `@firebase/rules-unit-testing` checks (member/non-member/owner access).
- `npm run emulators` + `npm run dev:emulator` — run the whole app locally against the
  emulator suite (no real Firebase project needed). Firestore emulator is on **port 8088**
  (8080 was taken locally); connection is gated by `VITE_USE_EMULATOR` in `src/lib/firebase.ts`.
