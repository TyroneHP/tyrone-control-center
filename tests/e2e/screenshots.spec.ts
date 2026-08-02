import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { installPreviewSession } from './previewSession'

const screenshotDirectory = 'docs/screenshots'

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

async function captureTrainingScreenshot(
  page: Page,
  name: string,
  fullPage = true,
) {
  const directory = `${screenshotDirectory}/training-ui-foundation`
  mkdirSync(directory, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    fullPage,
    path: `${directory}/${name}`,
  })
}

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

test('captures mobile training UI foundation states', async ({ page }, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-dashboard-mobile.png')

  await page.getByRole('link', { name: 'Pläne' }).click()
  await expect(page).toHaveURL(new RegExp(`${trainingPath('/plans/new')}$`))
  await expect(page.getByRole('heading', { name: 'Grundlagen' })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-wizard-basics-mobile.png')
  await page.getByLabel('Planname').fill('Screenshot-Plan')
  await page.getByRole('button', { name: 'Montag' }).click()
  await page.getByRole('button', { name: 'Weiter zu Übungen' }).click()
  await expect(page.getByRole('heading', { name: 'Übungen' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Übungen suchen' })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-wizard-exercises-mobile.png')
  await page
    .getByRole('button', { exact: true, name: 'Bankdrücken auswählen' })
    .click()
  await page.getByRole('button', { name: 'Weiter zu Anpassen' }).click()
  await expect(page.getByRole('heading', { name: 'Anpassen' })).toBeVisible()
  await expect(page.getByTestId('plan-exercise-row')).toBeVisible()
  await captureTrainingScreenshot(page, 'training-wizard-customize-mobile.png')
  await page.getByRole('button', { name: 'Weiter zu Vorschau' }).click()
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Planvorschau' })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-wizard-preview-mobile.png')
  await page.getByRole('button', { name: 'Plan speichern' }).click()
  await page
    .getByRole('button', { name: 'Plan öffnen: Screenshot-Plan' })
    .click()
  await expect(page).toHaveURL(/\/training\/plans\/plan-/)
  await expect(page.getByRole('heading', { name: 'Screenshot-Plan' })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-plan-detail-mobile.png')

  await page.goto(trainingPath('/library'))
  await expect(page).toHaveURL(new RegExp(`${trainingPath('/library')}$`))
  await expect(page.getByRole('heading', { name: 'Übungsbibliothek' })).toBeVisible()
  await expect(page.getByText('50 Übungen')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(10_900)
  await captureTrainingScreenshot(page, 'training-library-mobile.png')
  await page.getByRole('button', { name: 'Filter öffnen' }).click()
  await expect(page.getByRole('dialog', { name: 'Übungen filtern' })).toBeVisible()
  await captureTrainingScreenshot(
    page,
    'training-library-filter-mobile.png',
    false,
  )

  await page.goto(trainingPath('/active'))
  await expect(page).toHaveURL(new RegExp(`${trainingPath('/active')}$`))
  await expect(page.getByRole('heading', { name: 'Oberkörper' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Übung wechseln' })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-active-session-mobile.png')
})

test('captures the desktop training dashboard', async ({ page }, testInfo) => {
  requireScreenshotCapture(testInfo.project.name, 'desktop-chromium')
  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible()
  await captureTrainingScreenshot(page, 'training-dashboard-desktop.png')
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Playwright requires an object-destructured fixture parameter.
test('keeps every named training screenshot artifact visually distinct', async ({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  const names = [
    'training-active-session-mobile.png',
    'training-dashboard-desktop.png',
    'training-dashboard-mobile.png',
    'training-library-filter-mobile.png',
    'training-library-mobile.png',
    'training-plan-detail-mobile.png',
    'training-wizard-basics-mobile.png',
    'training-wizard-customize-mobile.png',
    'training-wizard-exercises-mobile.png',
    'training-wizard-preview-mobile.png',
  ]
  const hashes = names.map((name) =>
    createHash('sha256')
      .update(readFileSync(`${screenshotDirectory}/training-ui-foundation/${name}`))
      .digest('hex'),
  )

  expect(new Set(hashes).size).toBe(names.length)
})
