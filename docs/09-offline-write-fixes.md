# Batch 9 — Offline writes no longer freeze the UI

## Problem
Saving an expense while offline left the Save button spinning and never redirected
home. Root cause: a Firestore write promise (`addDoc`/`setDoc`/`updateDoc`) only
**resolves once the write reaches the server**. The code did `await addExpense(...)`
before `navigate(...)`, so offline the `await` hangs forever — `navigate` never runs
and `busy` stays `true`. The local cache write, however, is applied *synchronously*
and live listeners update immediately, so there's no reason to wait.

## Fix — navigate/optimistically update without awaiting the server
- **`src/pages/AddExpense.tsx`** — `submit` and `onDelete` now fire the write
  (`addExpense` / `updateExpense` / `createInstallmentPlan` / `deleteExpense`) and
  `navigate()` immediately, attaching a `.catch` for logging instead of `await`ing.
  The new/edited expense shows up right away (from the local cache) and syncs when
  back online.
- **`src/pages/PlanDetail.tsx`** — `link` / `unlink` (and the best-effort plan-total
  update) likewise no longer `await`; the modal closes and the row list refreshes
  from the live listener immediately. Removed the now-unused `busy` gating.
- **`src/hooks/useAuth.tsx`** — the background profile fetch now has a `.catch`, so an
  offline cache-miss can't surface as an unhandled rejection.

## Notes
- App shell is already precached (SW `navigateFallback → index.html`) and Firestore
  data is offline-cached, so reads/navigation already work offline; this batch was
  purely about not blocking on write acks.

## Verify
- Offline (airplane mode): add an expense → redirects home instantly and the expense
  appears; toggle back online → it syncs. Same for edit, delete, and installment
  plan create. Plan detail link/unlink work offline too.
- `npx tsc --noEmit`, `npm run build`, `npm test -- --run` clean.
