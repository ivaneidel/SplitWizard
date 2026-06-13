# Batch 8 — Edit installment plans (attach a missed expense)

## Problem
The Excel import auto-detector (`src/lib/installmentDetect.ts`) groups installment
rows only when they share an **identical amount** (amount is part of the grouping
key). When the first installment is pricier than the rest — a recurring real-world
pattern — that first row fails detection and lands as a **standalone expense**, while
the plan is built from the remaining equal rows. There was no way to fix this after
the fact.

## Key model facts
- A plan = one `InstallmentPlan` doc (`installmentPlans/`) + N `Expense` docs linked by
  `installmentPlanId` (+ `installmentIndex`).
- The UI derives plan size/progress from the **expense rows**, not the plan doc:
  `planProgress()` uses `total: rows.length`; `forecastByMonth()` sums the rows. So the
  missed expense isn't a visible "gap" — it's just an unlinked expense in the group, and
  the fix is to **set its `installmentPlanId`**.

## Changes
- **`src/lib/firestore.ts`**: `deleteField` import + three helpers:
  - `linkExpenseToPlan(groupId, expenseId, planId, installmentIndex)` (wraps `updateExpense`).
  - `unlinkExpenseFromPlan(groupId, expenseId)` (raw `updateDoc` with `deleteField()` on
    `installmentPlanId`/`installmentIndex`).
  - `updateInstallmentPlan(planId, patch)` — keeps the plan doc's `totalAmount` truthful.
- **New `src/pages/PlanDetail.tsx`** (route `/installments/:planId`, added in `src/App.tsx`):
  - Lists the plan's installments (sorted by date); each links to the existing expense
    edit screen; each has an **unlink** action to return it to a standalone expense.
  - Summary header (base name, paid/total, total per currency, next due date) and a
    **missing-row hint** when `rows.length < declared count` (parsed from the `i/M` names).
  - **"Add missing installment"** → `Modal` picker of the group's unlinked expenses
    (with a filter). Tapping one folds it into the plan: index inferred from its own
    `i/M` name (else next index), then `totalAmount` is re-persisted. Wrong links are
    undoable via unlink.
- **`src/pages/Installments.tsx`**: plan cards are now tappable `Link`s to the detail page.
- **`firestore.rules`**: added `allow update` on `installmentPlans/{id}` for members of
  the referenced group (group ownership of the doc immutable) — previously only
  create/read/delete were permitted, so the `totalAmount` edit needs it.

Out of scope (per user): changing the import detector; creating brand-new installments
from the detail page (only linking existing expenses).

## Verify & deploy
- `npx tsc --noEmit`, `npm run build`, `npm test -- --run` clean.
- Installments → tap a plan → "Add missing installment" → pick the pricier standalone
  expense → it joins the plan (progress/total/forecast update; group page reads it as
  part of the plan). Unlink returns it to standalone.
- `npm run build && npx firebase deploy --only hosting`.
