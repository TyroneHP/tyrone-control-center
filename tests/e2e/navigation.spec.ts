import { expect, test } from '@playwright/test'

test('shows German login branding without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/login')

  await expect(page).toHaveTitle('Tyrone Control Center')
  await expect(page.getByText('Tyrone Control Center')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Willkommen zurück.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()

  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fitsViewport).toBe(true)
})
