import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { getViteBasePath } from './src/config/basePath'
import { pwaOptions } from './src/pwa/pwaConfig'

export default defineConfig(({ mode }) => ({
  base: getViteBasePath(mode),
  plugins: [react(), VitePWA(pwaOptions)],
  test: {
    environment: 'jsdom',
    exclude: ['node_modules/**', 'dist/**', 'supabase/**', 'tests/e2e/**'],
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}))
