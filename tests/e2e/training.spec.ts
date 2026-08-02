import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

test('registers the production-preview service worker', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The production service-worker check runs once in desktop Chromium.',
  )
  test.skip(
    process.env.E2E_PRODUCTION_PREVIEW !== 'true',
    'Requires npm run build and a production Vite preview on port 5173.',
  )

  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration()),
      ),
    )
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return Boolean(registration?.waiting ?? registration?.active)
      }),
    )
    .toBe(true)
})
