import { describe, expect, it } from 'vitest'
import { pwaOptions } from './pwaConfig'

describe('PWA configuration', () => {
  it('uses the confirmed Pages scope and Slate manifest', () => {
    expect(pwaOptions).toMatchObject({
      registerType: 'prompt',
      manifest: {
        background_color: '#071526',
        display: 'standalone',
        lang: 'de',
        name: 'Tyrone Control Center',
        scope: '/tyrone-control-center/',
        short_name: 'Control Center',
        start_url: '/tyrone-control-center/',
        theme_color: '#071526',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    })
  })

  it('declares the SVG app icon without API runtime caching', () => {
    expect(pwaOptions.manifest?.icons).toContainEqual({
      purpose: 'any maskable',
      sizes: 'any',
      src: 'icon.svg',
      type: 'image/svg+xml',
    })
    expect(pwaOptions.workbox?.runtimeCaching).toEqual([])
  })
})
