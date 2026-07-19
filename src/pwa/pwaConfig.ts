import type { VitePWAOptions } from 'vite-plugin-pwa'

export const pwaOptions = {
  registerType: 'prompt',
  manifest: {
    name: 'CoreGrid',
    short_name: 'CoreGrid',
    theme_color: '#071526',
    background_color: '#071526',
    display: 'standalone',
    lang: 'de',
    start_url: '/tyrone-control-center/',
    scope: '/tyrone-control-center/',
    icons: [
      {
        src: 'icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    navigateFallback: 'index.html',
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    runtimeCaching: [],
  },
} satisfies Partial<VitePWAOptions>
