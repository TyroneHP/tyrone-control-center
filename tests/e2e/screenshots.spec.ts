import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const userId = '11111111-1111-1111-1111-111111111111'
const timestamp = '2026-07-17T00:00:00.000Z'
const profile = {
  created_at: timestamp,
  deactivated_at: null,
  deletion_scheduled_at: null,
  display_name: 'Tyrone',
  email: 'admin@example.test',
  id: userId,
  invitation_id: null,
  role: 'admin',
  status: 'active',
  updated_at: timestamp,
}

async function installPreviewSession(page: Page) {
  await page.addInitScript(
    ({ id, now }) => {
      window.localStorage.setItem(
        'sb-127-auth-token',
        JSON.stringify({
          access_token: 'preview-access-token-placeholder',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          refresh_token: 'preview-refresh-token-placeholder',
          token_type: 'bearer',
          user: {
            app_metadata: { provider: 'email', providers: ['email'] },
            aud: 'authenticated',
            created_at: now,
            email: 'admin@example.test',
            email_confirmed_at: now,
            id,
            role: 'authenticated',
            updated_at: now,
            user_metadata: {},
          },
        }),
      )
    },
    { id: userId, now: timestamp },
  )
  await page.route('http://127.0.0.1:54321/rest/v1/profiles**', (route) =>
    route.fulfill({
      body: JSON.stringify(profile),
      contentType: 'application/json',
      status: 200,
    }),
  )
}

test('captures the protected Foundation shell', async ({ page }, testInfo) => {
  test.skip(
    process.env.CAPTURE_SCREENSHOTS !== 'true',
    'Set CAPTURE_SCREENSHOTS=true to refresh committed preview images.',
  )
  await installPreviewSession(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible()

  const mobile = testInfo.project.name === 'iphone-webkit'
  if (mobile) {
    await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeVisible()
  } else {
    await expect(page.getByRole('navigation', { name: 'Desktop-Navigation' })).toBeVisible()
  }

  mkdirSync('docs/screenshots', { recursive: true })
  await page.screenshot({
    path: `docs/screenshots/foundation-${mobile ? 'mobile' : 'desktop'}.png`,
  })
})
