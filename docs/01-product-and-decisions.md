# 01 — Product & Decisions

## What it is
A personal expense-splitting PWA to replace Splitwise Pro. Single developer, fully-free
hosting, offline-capable. Originally "Splitwise Pro Copy", **renamed to SplitWizard** to
avoid trademark issues (the word "Splitwise" remains only where importing *from* the real
Splitwise export format).

## The two reason-to-exist features
1. **Auto-installments** — buy something in N monthly installments and auto-generate
   `X 1/N … X N/N`, dated on the same day each month. Replaces the manual Splitwise
   workflow of adding one dated expense per month.
2. **Excel import/export** — import full Splitwise history from the beginning of time;
   export anytime.

## Feature set

**Kept (core ledger)**
- Groups + 1:1 friends (a friend is just a 2-member group)
- Add expense with **multiple split modes**: equally / exact / percent / shares /
  adjustment / itemized
- Settle up (record a payment)
- **Debt simplification** (greedy min-cash-flow, toggle per group)
- Balances per group + global
- Categories + notes; **multi-currency** with per-expense FX rate
- Receipt attachments (Storage configured), comments, activity (modeled)
- **Global search** ("Search all over") by name or amount

**Splitwise-Pro-tier kept**
- Recurring/installments (unified into the installment engine)
- Spending charts + budgets

**Dropped (explicitly, by the user)**
- Settle-up reminders/nudges
- Receipt OCR scanning
- Itemized receipt *scan* (manual itemized split mode still exists)
- Natural-language quick-add
- Telegram bot

## QoL extras chosen
- **Installment forecast dashboard** — upcoming-by-month timeline + "due next month" rollup + per-plan progress.
- **Spending charts + per-category budgets**.
- (Considered but not chosen: NL quick-add, Telegram bot.)

## Key decisions (locked with the user)
- **Backend: Firebase** — Auth (Google SSO) + Firestore + Storage + Hosting. **No custom
  server.** (Chosen over MongoDB Atlas + serverless and over Supabase for the
  zero-backend, offline-first, all-free path.)
- **Installments are generated all upfront, future-dated**, grouped by an
  `installmentPlans` doc so they edit/delete together. (Chosen over a cron that
  materializes each month — no server needed.)
- **Multi-currency** with an FX rate captured **per expense at creation** so historical
  balances never drift.
- **Money stored as integer minor units** (cents) everywhere — never floats.
- **Balances kept per-currency** (exact zero-sum); settle-up never crosses currencies.
- **Global search is client-side** over the Firestore IndexedDB cache (dataset is small
  for a personal app; no Algolia/Typesense needed).
