# 04 — Enhancement Batches

Iterations after v1, in order. Each was planned, implemented, and verified (`tsc` clean,
tests green, build clean).

## Batch 1 — QoL & fixes
- **Dark mode** — System/Light/Dark toggle (System default), persisted, reacts to OS
  theme, applied before first paint (no flash). `useTheme` hook + `dark:` variants across
  the app.
- **Auto-select all members** when adding an expense (fixed a bug where the group loaded
  async so the initial selection was empty).
- **Group settings** — rename, change currency, toggle simplify-debts; manage members
  (add/remove); **archive**, **leave** (non-owners), **delete** (owner; cascades expenses
  + settlements + installment plans). Archived groups collapse into an "Archived" section
  on the dashboard.
- **Profile default-currency** edit in Settings.
- **Search date-range filter** (optional From/To; works alone or with the text query).
- **Expense editing + delete from the UI** — Add Expense doubles as an edit form; the
  `SplitEditor` accepts initial values (prefilled in `exact` mode so any stored split
  round-trips). Tap an expense to edit.
- **Charts**: capitalized category labels; **remove a category's monthly cap**.

## Batch 2 — Dark theme + import fixes + guests + claiming
- **Neutral dark theme** — switched dark-mode tokens from blue-tinted `slate` to neutral
  `zinc`; body background to `#18181b`.
- **Splitwise CSV import fixed** for real-world files:
  - **UTF-8** — CSVs read via `file.text()` so accents survive (was mis-read as
    Windows-1252 → `DescripciÃ³n`).
  - **Localized headers** — the first 5 columns are taken **positionally**
    (date/description/category/cost/currency in any language) and the rest as people
    (was matching English header names, so Spanish files imported 0 rows).
  - Skips the totals row in any language (`Total balance` / `Saldo total`).
- **Guest (placeholder) members** — people who hold balances but have no account
  (`local_*` ids, `placeholder:true`). Added via Group Settings ("App user" vs "Guest"
  toggle). Lets history be imported for people who haven't signed up.
- **Claim / link a guest to a real account** — `claimGuest` rewrites a guest's `local_*`
  id to a real uid across every expense (`paidBy`/`splits`/`participantUids`) and
  settlement in the group, then swaps the member entry (summing if both appear on one
  expense). "Link" button on each guest in Group Settings. → *Import now, invite later.*

## Batch 3 — Dates, months, categories, personal stake
- **YYYY-MM-DD dates** everywhere (`formatDate`, UTC — also fixes an off-by-one in
  negative-UTC zones since dates are stored at UTC midnight).
- **Month sections** in a group's expense list (`June 2026` headers between months).
- **Custom categories** — the category field is a free-text combobox with suggestions
  (built-ins ∪ categories already used in the group); new ones persist naturally.
- **Per-expense personal stake** under the amount: pastel green "you lent X" when you
  paid more than your share, pastel rose "lent to you X" when someone covered you.

## Batch 4 — Infer installment plans on import
- The importer detects manually-entered installment series and materializes them as real
  plans. A `Base N/M` row is a candidate; rows are grouped by **base + M + currency +
  amount + payer + split**, and become one plan only if **≥2 rows have consecutive
  indices in consecutive months**. Detected series are written as an `installmentPlans`
  doc with the (real-dated) rows linked — so they appear in the Plans dashboard.
- Toggle "Detect installment plans" (default on) in the import box; preview shows
  detected plans (e.g. "Tele ×10").

## Batch 5 — UI polish
- **Settle-up** payer/payee stacked on two full-width lines (long names no longer
  overflow).
- **Completed installment plans collapse** under a "Completed (N)" toggle on the Plans
  page; only in-progress plans show expanded.
- **Upcoming-by-month** forecast items given more presence: `text-sm` divided rows with
  the per-row amount on the right.

## Batch 6 — Form & chart micro-polish
- **Category & Date** fields in Add/Edit Expense now share the row **50/50** (both `flex-1`).
- **Native `<select>` arrows** get breathing room app-wide: a global `index.css` rule
  swaps the flush native arrow for a chevron with a right gap (`appearance:none` +
  background chevron + `padding-right` override). Fixes all dropdowns in one place.
- **Monthly trend range** on the Charts page: an "All time" / per-year selector filters
  the bar chart (years derived from the data).

> Verification after Batch 6: 39 unit tests green; `tsc` + production build clean.
> Deployed to https://splitwizard.web.app.
