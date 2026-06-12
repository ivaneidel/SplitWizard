# Batch 6 — UI polish, dashboard-balance fix & amber rebrand

Follows the batch-5 shortcut/lean-AddExpense work. Four changes requested:

## 1. Vertically center the Add Expense screen
`AppLayout`'s `<main>` is `flex-1 overflow-y-auto`. Add Expense is short, so it
hugs the top. We center it vertically when it fits and still allow scroll when
it doesn't.

- **`src/pages/AddExpense.tsx`** — outer wrapper becomes a full-height flex column
  that centers its content: `flex min-h-full flex-col justify-center`, with the
  existing `mx-auto max-w-md space-y-4` moved to an inner content `div`. Tall forms
  (installments open) still scroll because `<main>` owns `overflow-y-auto`.

## 2. `/add` deep-link: switchable group dropdown (no forced redirect)
Today `/add` (the PWA shortcut / deep link) auto-redirects to the last/only group
via `QuickAdd`. Instead, land directly on the Add Expense form with a **group
`<select>` pre-selected to the suggested group but changeable**.

- Point the `/add` route at `AddExpense` and **remove `QuickAdd.tsx`**
  (`src/App.tsx`, delete `src/pages/QuickAdd.tsx`).
- **`src/pages/AddExpense.tsx`** — make the group stateful:
  - `const { groupId: routeGroupId, expenseId } = useParams()`; `const [groupId,
    setGroupId] = useState(routeGroupId)`.
  - When `!routeGroupId` and groups have loaded, default `groupId` to
    `localStorage.lastGroupId` (if still a member) else the first group.
  - Replace the one-time "new expense" defaults init with an effect keyed on
    `group?.id` so switching groups resets currency / payer / selected members to
    that group's defaults (editing prefill stays one-time via `initRef`).
  - Render a group `<select>` at the top of the form **only when `!routeGroupId &&
    !editing`** (i.e. arrived via `/add`); options = `groups`.
  - No-groups case: show "Create a group first" instead of the loading state.

## 3. Dashboard "This month" misses expenses from unvisited groups
**Root cause:** `useAllExpenses` uses a Firestore `collectionGroup('expenses')`
query. With `persistentLocalCache` (enabled in `src/lib/firebase.ts`), a
collection-group listener only surfaces docs from subcollections that a *direct*
listener has already primed — so totals stayed stale until you opened each group
(which mounts `watchGroupExpenses`). `watchUserGroups` is a plain top-level query,
so the group list itself is always complete.

**Fix:** rewrite **`src/hooks/useAllExpenses.ts`** to fan out one
`watchGroupExpenses` listener per group (ids from `useGroups`) and merge results,
filtered to `participantUids.includes(uid)` to preserve the old "only my expenses"
semantics. Direct per-group listeners always sync fully from the server, so the
dashboard, search, charts, activity and installments (all consumers) now stay
fresh without visiting each group. Listeners are torn down / re-subscribed when the
group set changes.

## 4. Rebrand accent: Splitwise-green → Amber
Swap the `emerald` accent (14 files, ~64 occurrences) for Tailwind **`amber`**, plus
the two hard-coded greens:
- `src/**` — replace `emerald-` utility classes with `amber-` (same shade numbers).
- `vite.config.ts` — `theme_color: '#1cc29f'` → `'#d97706'` (amber-600).
- `src/pages/Charts.tsx` — `COLORS[0]` and the `<Bar fill>` `#1cc29f` → `#d97706`.
- Rose/red (negative balances, sign-out, delete) is left untouched.
- The PNG app icons stay green for now (regenerating is out of scope; noted here).

## Verify & deploy
- `npx tsc --noEmit` + `npm run build` clean.
- Add a new expense from a group you haven't opened this session → it appears in
  the home "This month" total immediately.
- Open `/add` → group dropdown defaults to last-used group, switchable; saving lands
  on that group.
- Add Expense is vertically centered; opening "More" still scrolls.
- App accent is amber throughout (header, nav, buttons, charts, PWA toolbar).
- `npm run build && npx firebase deploy --only hosting`.
