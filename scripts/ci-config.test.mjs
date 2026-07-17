import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function workflow(name) {
  return readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')
}

describe('GitHub Actions configuration', () => {
  it('runs all quality checks with the pinned Foundation toolchain', () => {
    const ci = workflow('ci.yml')

    expect(ci).toContain('actions/checkout@v6')
    expect(ci).toContain('actions/setup-node@v6')
    expect(ci).toContain('node-version: 22.12.0')
    expect(ci).toContain('cache: npm')
    for (const command of [
      'npm ci',
      'npm run lint',
      'npm run typecheck',
      'npm run test',
      'npm run security:scan',
      'npm run build',
    ]) {
      expect(ci).toContain(`run: ${command}`)
    }
  })

  it('deploys dist to Pages with explicit permissions and public build secrets', () => {
    const deploy = workflow('deploy-pages.yml')

    for (const action of [
      'actions/checkout@v6',
      'actions/setup-node@v6',
      'actions/configure-pages@v5',
      'actions/upload-pages-artifact@v4',
      'actions/deploy-pages@v4',
    ]) {
      expect(deploy).toContain(action)
    }
    expect(deploy).toContain('contents: read')
    expect(deploy).toContain('pages: write')
    expect(deploy).toContain('id-token: write')
    expect(deploy).toContain('group: pages')
    expect(deploy).toContain('VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}')
    expect(deploy).toContain(
      'VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}',
    )
    expect(deploy).toContain('path: ./dist')
  })
})
