import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

test('personalizes desktop theme and sidebar without overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByRole('switch', { name: 'Dunkelmodus' }).uncheck()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const settings = page.getByRole('main')
  await settings
    .getByRole('button', { name: 'Seitenleiste einklappen' })
    .click()
  const sidebar = page.locator('.app-shell__sidebar')
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expect(
    sidebar.getByRole('button', { name: 'Seitenleiste ausklappen' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('configures five mobile tabs and opens every destination', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByLabel('Tab 2', { exact: true }).selectOption('files')
  await page.getByRole('button', { name: 'Tab 2 nach rechts' }).click()
  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await expect(mobile.getByRole('link')).toHaveCount(4)
  await expect(mobile.getByRole('button', { name: 'Mehr' })).toBeVisible()
  await mobile.getByRole('button', { name: 'Mehr' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Alle Bereiche' }).getByRole('link'),
  ).toHaveCount(10)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('keeps mobile navigation immediately operable with reduced motion', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installPreviewSession(page, 'member')
  await page.goto('/settings')

  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await mobile.getByRole('button', { name: 'Mehr' }).click()
  const destinations = page.getByRole('dialog', { name: 'Alle Bereiche' })
  await expect(destinations.getByRole('link')).toHaveCount(10)
  await destinations.getByRole('link', { name: 'Kalender' }).click()
  await expect(page).toHaveURL(/\/calendar$/)
})
