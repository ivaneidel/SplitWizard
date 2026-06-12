# 05 — Deploy & Ops

## Live URLs
- **https://splitwizard.web.app** (primary — dedicated Hosting site `splitwizard`)
- https://splitwizard-b2dc2.web.app (default site, also live)

Firebase project: **`splitwizard-b2dc2`** (the plain `splitwizard` project id was taken,
so Firebase suffixed it; the *Hosting site* id `splitwizard` was free and is used for the
nice URL). Hosting `site` is pinned in `firebase.json` → `hosting.site = "splitwizard"`.

## One-time Firebase setup (already done)
1. Project created at console.firebase.google.com.
2. **Authentication** → enable **Google** sign-in.
3. **Firestore** → created (production mode).
4. Web app registered; config copied into `.env.local` (`VITE_FIREBASE_*`, see
   `.env.example`).
5. Rules + indexes deployed: `firebase deploy --only firestore:rules,firestore:indexes`.
6. Hosting site created: `firebase hosting:sites:create splitwizard`.

> If Google sign-in shows `auth/unauthorized-domain` on a new URL, add it under
> **Authentication → Settings → Authorized domains**.

## Commands
```bash
# Develop
npm install
npm run dev                 # local dev (uses real Firebase via .env.local)
npm test                    # engine unit tests (Vitest)

# Local Firebase emulator (no real project needed)
npm run emulators           # terminal 1: Auth+Firestore+Storage emulators
npm run dev:emulator        # terminal 2: app with VITE_USE_EMULATOR=true
npm run test:rules          # security-rules tests against the emulator

# Build & deploy
npm run build               # tsc -b + vite build (PWA) → dist/
npx firebase deploy --only hosting
# rules/indexes when changed:
npx firebase deploy --only firestore:rules,firestore:indexes
```

## Env vars (`.env.local`, from `.env.example`)
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
Optional: `VITE_USE_EMULATOR=true` to point the app at local emulators.

## Notes
- Hosting serves the static `dist/` build; Auth/Firestore/Storage are the shared backend
  — local dev (non-emulator) and the deployed site use the **same data**.
- It's an installable PWA (manifest + service worker in `dist/`); "Add to Home Screen".
- Ports: Firestore emulator **8088**, Auth 9099, Storage 9199, Emulator UI 4000.
