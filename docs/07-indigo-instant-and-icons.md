# Batch 7 — Indigo rebrand, instant/offline loading, icon & splash fix

Follows batch 6. The amber accent was disliked; switching to **indigo**, plus
instant-feeling loads and a fixed PWA splash.

## 1. Accent: Amber → Indigo
Mechanical swap, same as the previous rebrand:
- `src/**` — `amber-` utility classes → `indigo-`.
- `vite.config.ts` — `theme_color` `#d97706` → `#4f46e5` (indigo-600).
- `src/pages/Charts.tsx` — the two `#d97706` hexes → `#4f46e5`.

## 2. Icons recolored to indigo + splash fix
The PWA splash showed the old green icon, oversized, on a stark white background
(manifest `background_color: '#ffffff'`). Regenerate icons in indigo and make the
splash cohesive.
- Regenerate from an indigo squircle "S" (ImageMagick, fonts confirmed working):
  - `public/pwa-192x192.png`, `public/pwa-512x512.png` — rounded squircle, white S
    (purpose `any`).
  - `public/pwa-maskable-512.png` — **new**, full-bleed indigo (no rounded corners)
    with the S inside the central safe zone, so launcher masking and the splash icon
    look right (not oversized/edge-to-edge).
  - `public/apple-touch-icon.png` (180), `public/favicon.svg` — indigo.
- `vite.config.ts` manifest:
  - `background_color: '#4f46e5'` → splash becomes branded indigo instead of white.
  - icons array: 192 + 512 (`any`) + the new maskable-512 (`maskable`).

## 3. Instant, offline-friendly loading + shimmer skeletons
**Root cause of the lag:** `ProtectedRoute` blocks the *entire* app behind a
full-screen "Loading…" until Firebase finishes restoring the session from IndexedDB
(`onAuthStateChanged`). Firestore data itself is already offline-cached
(`persistentLocalCache`) and the app shell is already precached by the service
worker — so once we stop blocking, returning users can render instantly.

- **`src/hooks/useAuth.tsx`**
  - Flip `loading` to `false` as soon as the auth state is known; fetch the profile
    in the background (don't await `bootstrapProfile` before rendering).
  - Persist a `hadSession` flag in `localStorage` (set when a user resolves, cleared
    on sign-out).
- **`src/components/ProtectedRoute.tsx`** — while auth is still loading, if
  `hadSession` is set, render the app **optimistically** (children show skeletons,
  data hydrates from cache the instant `user` resolves) instead of a blank gate.
  First-time/logged-out users still get a minimal splash, then login.
- **`src/components/Skeleton.tsx`** — new reusable `animate-pulse` shimmer block.
- Replace the "Loading…" text gates with skeletons:
  - **Dashboard** — skeleton group rows + a skeleton "This month" card while loading.
  - **GroupPage** — skeleton header / balance card / list while loading.
  - **AddExpense** — skeleton form while the group resolves (keeps the leaner layout).

Offline add already works (writes queue in the Firestore cache and the UI updates
optimistically); removing the loading gate is what makes it feel instant.

## Verify & deploy
- `npx tsc --noEmit`, `npm run build`, `npm test -- --run` all clean.
- Reload the installed PWA: no blank "Loading…" — skeletons appear, then content
  hydrates; opening Add Expense is immediate, including offline (airplane mode).
- Splash shows the indigo icon on an indigo background (no stark white).
- Accent is indigo throughout (header, nav, buttons, charts, PWA toolbar).
- `npm run build && npx firebase deploy --only hosting`.
