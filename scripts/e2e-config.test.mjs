import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Playwright configuration', () => {
  it('defines the required desktop Chromium and iPhone WebKit projects', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'playwright.config.ts'),
      'utf8',
    )

    expect(config).toContain("name: 'desktop-chromium'")
    expect(config).toContain("devices['Desktop Chrome']")
    expect(config).toContain("name: 'iphone-webkit'")
    expect(config).toContain("devices['iPhone 13']")
    expect(config).toContain("browserName: 'webkit'")
  })
})
