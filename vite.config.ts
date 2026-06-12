/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SplitWizard',
        short_name: 'SplitWizard',
        description: 'Expense splitting with auto-installments',
        theme_color: '#4f46e5',
        background_color: '#4f46e5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Android long-press launcher shortcut. Web manifests only support
        // static shortcuts (no dynamic per-group entries). /add resolves to the
        // last-viewed group or a group picker.
        shortcuts: [
          {
            name: 'Add expense',
            short_name: 'Add expense',
            url: '/add',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // App shell only — Firestore handles its own offline data cache.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Emulator-backed rules tests run via their own config (npm run test:rules).
    exclude: ['**/node_modules/**', '**/*.rules.test.ts'],
  },
})
