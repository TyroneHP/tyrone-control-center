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

  it('keeps public signup disabled while allowing invited e-mail logins', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'supabase/config.toml'),
      'utf8',
    )
    const auth = config.match(/\[auth\]\s*([\s\S]*?)\n\[/)?.[1] ?? ''
    const email =
      config.match(/\[auth\.email\]\s*([\s\S]*?)\n\[/)?.[1] ?? ''

    expect(auth).toMatch(/enable_signup\s*=\s*false/)
    expect(email).toMatch(/enable_signup\s*=\s*true/)
  })
})
