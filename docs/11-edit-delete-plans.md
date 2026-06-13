# Batch 11 — Delete & bulk-edit installment plans

Extends the plan-detail page (`src/pages/PlanDetail.tsx`) with two header actions.

## 1. Delete a plan (and all its installments)
Trash button → `confirm()` → fires `deleteInstallmentPlan(groupId, planId)` (already
existed: batch-deletes the plan doc + every linked expense row) without awaiting
(offline-safe, per batch 9), then navigates back to `/installments`.

## 2. Bulk edit (description + final amount → applied to every installment)
Pencil button opens an "Edit plan" modal (description + total amount, prefilled).
Saving recomputes all rows:
- **New pure helper `redistributeInstallments(rows, totalAmount, baseDescription)`**
  (`src/lib/installments.ts`): splits the new total **evenly** across the rows
  (remainder on the earliest, via existing `splitEvenly`), divides each installment by
  the payer/split ratios of the **representative row** (the most common amount, so a
  drifted/pricier row doesn't skew the template), and rebases each description while
  keeping its trailing " i/M". Returns one `RowUpdate` per row.
- **`bulkEditInstallmentPlan(groupId, planId, rowUpdates, planPatch)`**
  (`src/lib/firestore.ts`): one `writeBatch` updating every row's
  amount/paidBy/splits/description plus the plan doc's `baseDescription`/`totalAmount`.
  Fired without awaiting. (Uses the `installmentPlans` `allow update` rule added in
  batch 8.)

### Drift warning
`amountsDrift(rows)` (new, in `installments.ts`) is true when row amounts differ by
more than the 1-minor-unit rounding an even split allows. When true, the edit modal
shows an amber warning ("these installments aren't all equal … saving will make them
equal") — informational only; the user can still save.

## Tests
`src/lib/engines.test.ts` — 3 new cases: drift detection, even redistribution +
kept i/M numbering + balanced splits, and remainder-on-earliest rounding. 44 total.

## Verify & deploy
- `npx tsc --noEmit`, `npm run build`, `npm test -- --run` clean.
- Plan detail → pencil → change total/description → all installments update (equal
  split, same numbering); drift warning shows for non-uniform plans. Trash → confirm →
  plan + rows gone, back to Installments. Works offline (instant, syncs later).
- `npm run build && npx firebase deploy --only hosting`.
