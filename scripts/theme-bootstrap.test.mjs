import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

test('applies a validated stored theme before React mounts', () => {
  expect(indexHtml).toContain('tcc.device-preferences.v1')
  expect(indexHtml).toMatch(/stored === 'light' \|\| stored === 'dark'/)
  expect(indexHtml).toContain('document.documentElement.dataset.theme = theme')
  expect(indexHtml).toMatch(/catch\s*\(_\)\s*\{\s*theme = 'dark'/)
  expect(indexHtml.indexOf('applyStoredTheme')).toBeLessThan(
    indexHtml.indexOf('/src/main.tsx'),
  )
})
