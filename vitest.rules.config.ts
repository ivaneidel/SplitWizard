import { defineConfig } from 'vitest/config'

// Emulator-backed Firestore security-rules tests. Run via `npm run test:rules`,
// which wraps this in `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.rules.test.ts'],
    // The emulator can be slow to answer the first request.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
