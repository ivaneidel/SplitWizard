# SplitWizard

Expense-splitting PWA with **auto-installments** and **Excel import/export**.
Vite + React + TS + Firebase (Auth + Firestore + Storage + Hosting).

## One-time Firebase setup (required to run)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication** → Sign-in method → enable **Google**.
3. **Firestore Database** → create (production mode).
4. **Project settings → General → Your apps** → add a **Web app**, copy the config.
5. Copy `.env.example` to `.env.local` and fill the `VITE_FIREBASE_*` values.
6. Install the Firebase CLI and deploy rules + indexes:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add        # pick your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests (Vitest)
npm run build      # production build (PWA)
```

## Deploy

```bash
npm run build
firebase deploy --only hosting
```

## Architecture

- `src/lib/` — framework-free, unit-tested engines:
  `money` (integer minor units), `splits` (all split modes), `balances`
  (per-currency netting + greedy debt simplification), `installments`
  (generate-all-upfront), `fx` (cached rates), `firestore` (data access).
- `src/hooks/` — `useAuth`, `useGroups`/`useGroupData` (Firestore `onSnapshot`).
- `src/pages/`, `src/components/` — UI.
- `firestore.rules` / `firestore.indexes.json` — security + collection-group index.

All money is stored as **integer minor units** (cents). Balances are kept
**per currency** so each currency's ledger is an exact zero-sum; settle-up math
never crosses currencies.
