import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// A native build bakes its addresses in and ships through app review, so a wrong one is costly: without
// the website's address invite links would be dead, and .env.local would point the app at this laptop.
const requireNativeEnv = (): Plugin => ({
  name: 'require-native-env',
  configResolved({ env }) {
    for (const name of ['VITE_APP_URL', 'VITE_SUPABASE_URL']) {
      if (!/^https:\/\//.test(env[name] ?? '')) {
        throw new Error(`Native builds need ${name} to be an https:// address. Set it in .env.production.local (it is "${env[name] ?? ''}").`)
      }
    }
  },
})

export default defineConfig({
  plugins: [
    process.env.NATIVE_BUILD ? requireNativeEnv() : null,
    react(),
    tailwindcss(),
    VitePWA({
      // Ask before swapping in a new version so nobody loses a set mid-workout.
      registerType: 'prompt',
      // injectManifest: Workbox's generated worker breaks on the apostrophe in this folder's path.
      strategies: 'injectManifest',
      srcDir: 'sw',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Inside Out Training',
        short_name: 'Inside Out',
        description: 'A minimal strength-training journal.',
        theme_color: '#070b18',
        background_color: '#070b18',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Fonts are precached so the app looks right offline (Latin subsets only; see src/styles/fonts.css).
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico}', 'assets/*-latin-wght-normal-*.woff2'] },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Vitest blanks CSS imports, even ?raw, unless listed; the theme tests read src/styles as text.
    css: { include: [/\/src\/styles\//] },
  },
})
