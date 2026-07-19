import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

const screenshotDirectory = 'docs/screenshots'

function requireScreenshotCapture(projectName: string, requiredProject: string) {
  test.skip(
    process.env.CAPTURE_SCREENSHOTS !== 'true',
    'Set CAPTURE_SCREENSHOTS=true to refresh committed preview images.',
  )
  test.skip(projectName !== requiredProject)
}

test('captures Dark desktop with expanded navigation', async ({
  page,
}, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'desktop-chromium')
  await installPreviewSession(page, 'member')
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(
    page.getByRole('navigation', { name: 'Desktop-Navigation' }),
  ).toBeVisible()

  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    path: `${screenshotDirectory}/design-dark-desktop-expanded.png`,
  })
})

test('captures Light desktop with collapsed navigation', async ({
  page,
}, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'desktop-chromium')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByRole('switch', { name: 'Dunkelmodus' }).uncheck()
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Seitenleiste einklappen' })
    .click()
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(
    page.getByRole('button', { name: 'Seitenleiste ausklappen' }),
  ).toBeVisible()

  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    path: `${screenshotDirectory}/design-light-desktop-collapsed.png`,
  })
})

test('captures the configured iPhone tab bar', async ({ page }, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByLabel('Tab 2', { exact: true }).selectOption('files')
  await page.getByRole('button', { name: 'Tab 2 nach rechts' }).click()
  await page.goto('/')
  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await expect(mobile.getByRole('link')).toHaveCount(4)
  await expect(mobile.getByRole('button', { name: 'Mehr' })).toBeVisible()

  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    path: `${screenshotDirectory}/design-mobile-tabs.png`,
  })
})

test('captures personal Settings with deterministic admin data', async ({
  page,
}, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'desktop-chromium')
  await installPreviewSession(page, 'admin')
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Darstellung' })).toBeVisible()
  await expect(page.getByText('2 von 10')).toBeVisible()

  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: `${screenshotDirectory}/design-settings-personalization.png`,
  })
})
