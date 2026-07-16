import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { getViteBasePath } from './src/config/basePath'

export default defineConfig(({ mode }) => ({
  base: getViteBasePath(mode),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}))
