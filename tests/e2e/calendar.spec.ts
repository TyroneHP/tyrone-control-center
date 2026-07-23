import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

const memberCalendarKey =
  'coregrid:calendar-events:v1:22222222-2222-2222-2222-222222222222'

function localIsoDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

test('renders and navigates the responsive month calendar without overflow', async ({
  page,
}, testInfo) => {
  await installPreviewSession(page, 'member')
  await page.goto('/calendar')
  await page.evaluate((key) => window.localStorage.removeItem(key), memberCalendarKey)
  await page.reload()

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

  if (testInfo.project.name === 'iphone-webkit') {
    const everyDateButtonFillsItsCell = await calendar
      .locator('td')
      .evaluateAll((cells) =>
        cells.every((cell) => {
          const button = cell.querySelector('button')
          if (!button) return false
          const cellBox = cell.getBoundingClientRect()
          const buttonBox = button.getBoundingClientRect()
          return (
            Math.abs(cellBox.width - buttonBox.width) <= 1 &&
            Math.abs(cellBox.height - buttonBox.height) <= 1
          )
        }),
      )
    expect(everyDateButtonFillsItsCell).toBe(true)
  }
})

test('creates, persists, edits, cancels deletion, and deletes a local event', async ({
  page,
}) => {
  const today = new Date()
  const createdDate = localIsoDate(today)
  const editedDate = localIsoDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  )

  await installPreviewSession(page, 'member')
  await page.goto('/calendar')
  await page.evaluate((key) => window.localStorage.removeItem(key), memberCalendarKey)
  await page.reload()

  await page.locator(`[data-date="${createdDate}"]`).click()
  await page.getByRole('button', { name: 'Termin erstellen' }).click()
  await page.getByLabel('Titel').fill('Arzt')
  await page.getByLabel('Startzeit').fill('10:00')
  await page.getByLabel('Endzeit').fill('11:00')
  await page.getByLabel('Beschreibung').fill('Jährliche Kontrolle')
  await page.getByRole('button', { name: 'Termin speichern' }).click()

  await expect(page.locator(`[data-date="${createdDate}"]`)).toContainText('Arzt')
  await expect(page.getByRole('heading', { name: 'Arzt' })).toBeVisible()
  await expect(page.getByText('10:00–11:00')).toBeVisible()
  await expect(page.getByText('Jährliche Kontrolle')).toBeVisible()
  await page.reload()
  await page.locator(`[data-date="${createdDate}"]`).click()
  await expect(page.getByRole('heading', { name: 'Arzt' })).toBeVisible()
  await expect(page.getByText('10:00–11:00')).toBeVisible()
  await expect(page.getByText('Jährliche Kontrolle')).toBeVisible()

  await page.getByRole('button', { name: 'Arzt bearbeiten' }).click()
  await page.getByLabel('Titel').fill('Zahnarzt')
  await page.getByLabel('Datum').fill(editedDate)
  await page.getByRole('button', { name: 'Termin speichern' }).click()
  await expect(page.locator(`[data-date="${editedDate}"]`)).toContainText('Zahnarzt')
  await expect(page.locator(`[data-date="${createdDate}"]`)).not.toContainText('Arzt')

  await page.getByRole('button', { name: 'Zahnarzt bearbeiten' }).click()
  await page.getByRole('button', { name: 'Termin löschen' }).click()
  await page
    .getByRole('dialog', { name: 'Termin löschen' })
    .getByRole('button', { name: 'Abbrechen' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Termin bearbeiten' })).toBeVisible()
  await page.getByRole('button', { name: 'Termin löschen' }).click()
  await page
    .getByRole('dialog', { name: 'Termin löschen' })
    .getByRole('button', { name: 'Termin endgültig löschen' })
    .click()

  await expect(page.getByRole('heading', { name: 'Zahnarzt' })).toHaveCount(0)
  await expect(page.locator(`[data-date="${editedDate}"]`)).not.toContainText(
    'Zahnarzt',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('keeps a long unbroken event title within the calendar and delete dialog', async ({
  page,
}) => {
  const today = localIsoDate(new Date())
  const longTitle = 'CoreGridTermin'.repeat(30)

  await installPreviewSession(page, 'member')
  await page.goto('/calendar')
  await page.evaluate((key) => window.localStorage.removeItem(key), memberCalendarKey)
  await page.reload()

  await page.locator(`[data-date="${today}"]`).click()
  await page.getByRole('button', { name: 'Termin erstellen' }).click()
  await page.getByLabel('Titel').fill(longTitle)
  await page.getByRole('button', { name: 'Termin speichern' }).click()

  const eventCard = page.locator('.calendar-selected-day article').filter({
    has: page.getByRole('heading', { name: longTitle }),
  })
  await expect(eventCard).toBeVisible()
  expect(
    await eventCard.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.getByRole('button', { name: `${longTitle} bearbeiten` }).click()
  await page.getByRole('button', { name: 'Termin löschen' }).click()

  const deleteDialog = page.getByRole('dialog', { name: 'Termin löschen' })
  const cancelDelete = deleteDialog.getByRole('button', { name: 'Abbrechen' })
  const confirmDelete = deleteDialog.getByRole('button', {
    name: 'Termin endgültig löschen',
  })
  await expect(deleteDialog).toBeVisible()
  expect(
    await deleteDialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await expect(cancelDelete).toBeInViewport()
  await expect(confirmDelete).toBeInViewport()
})
