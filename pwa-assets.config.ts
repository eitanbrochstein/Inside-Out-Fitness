import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Icons are generated from public/favicon.svg: `pnpm icons`.
const midnight = { background: '#070b18', fit: 'contain' } as const

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: midnight },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: midnight },
  },
  images: ['public/favicon.svg'],
})
