# Batch 10 — Fluid page transitions

## Problem
Route changes were instant/abrupt — content swapped with no animation, which felt
harsh for a PWA. Wanted a smooth, native-feeling transition on every navigation, with
the header and bottom tab bar staying fixed.

## Approach (dependency-free, global)
Animate at the `<Outlet>` in `AppLayout` so it covers all navigations regardless of
trigger (NavLinks, list links, `navigate()`), with no per-link changes and no new
dependency.

- **`src/components/AppLayout.tsx`** — render `useOutlet()` inside a wrapper `div`
  keyed by `location.pathname` (+ class `page-transition`). The key change on each
  route remounts the wrapper, replaying the CSS enter animation. Keyed on `pathname`
  only (not search) so typing in Search (`?q=`) doesn't re-trigger it. The wrapper
  keeps the existing flex classes that let AddExpense stay vertically centered.
- **`src/index.css`** — `@keyframes page-enter` (opacity 0→1, translateY 8px→0,
  200ms ease-out), applied only under `@media (prefers-reduced-motion: no-preference)`.

## Notes
- Enter-only (new page animates in; old is replaced immediately) — avoids exit-then-
  enter latency and reads snappy. The `transform` exists only during the 200ms
  animation, so it doesn't affect `position: fixed` modals/popovers, which open after
  a navigation settles.
- Keying by pathname remounts the page on navigation (incl. group→group); data
  re-subscribes from the Firestore cache (fast) and the fade-in masks any skeleton.

## Verify
- Navigate Home ↔ Group ↔ Add ↔ Installments ↔ Settings: each page fades/slides in
  (~200ms); header + bottom nav stay put. Saving an expense → group page animates too.
- Typing in Search does not re-animate. AddExpense stays centered; tall forms scroll.
- OS/DevTools "reduce motion" → no animation.
- `npx tsc --noEmit`, `npm run build`, `npm test -- --run` clean.
