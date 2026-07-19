import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

test('renders and navigates the responsive month calendar without overflow', async ({
  page,
}) => {
  await installPreviewSession(page, 'member')
  await page.goto('/calendar')

  await expect(page.getByRole('heading', { name: 'Kalender' })).toBeVisible()
  const calendar = page.getByRole('table', { name: /Monatskalender/ })
  await expect(calendar).toBeVisible()
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1)

  const monthLabel = page.locator('.calendar-toolbar__title')
  const initialMonth = await monthLabel.innerText()
  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(monthLabel).not.toHaveText(initialMonth)

  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fitsViewport).toBe(true)
})
