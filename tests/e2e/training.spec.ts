import { expect, test, type Page } from '@playwright/test'
import { installPreviewSession } from './previewSession'

async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click()
  const picker = page.getByRole('dialog', { name: 'Übung auswählen' })
  await picker.getByRole('button', { name: `Details zu ${name}` }).click()
  await page
    .getByRole('dialog', { name })
    .getByRole('button', { name: 'Zum Training hinzufügen' })
    .click()
}

async function createUpperBodyTemplate(page: Page) {
  await page.goto(trainingPath('/templates/new'))
  await page.getByLabel('Name des Trainingsplans').fill('Oberkörper')
  await addExercise(page, 'Bankdrücken')
  await addExercise(page, 'Latziehen zur Brust')
  await page.getByRole('button', { name: 'Trainingsplan speichern' }).click()
  await page.getByRole('button', { name: 'Training starten: Oberkörper' }).click()
  await expect(page).toHaveURL(/\/training\/active$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Oberkörper' }),
  ).toBeVisible()
}

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

async function fillAndCompleteSets(
  page: Page,
  exerciseName: string,
  weight: string,
) {
  const exercise = page.locator('.active-workout__exercise').filter({
    has: page.getByRole('heading', { name: exerciseName }),
  })
  for (const setNumber of [1, 2, 3]) {
    await exercise.getByLabel(`Satz ${setNumber} Gewicht`).fill(weight)
    await exercise.getByLabel(`Satz ${setNumber} Wiederholungen`).fill('10')
    await exercise.getByLabel(`Satz ${setNumber} abgeschlossen`).check()
  }
}

test('completes the iPhone WebKit offline workout flow without overflow', async (
  { page },
  testInfo,
) => {
  test.skip(
    testInfo.project.name !== 'iphone-webkit',
    'The prescribed touch workflow runs once in iPhone WebKit.',
  )
  await installPreviewSession(page, 'member')
  await createUpperBodyTemplate(page)

  await expect(page.getByText('Ziel: 3 Sätze mit 8–12 Wiederholungen')).toHaveCount(2)
  await expect(page.locator('.active-workout__actions')).toHaveCSS('position', 'sticky')
  const touchTargets = await page
    .locator('.active-workout button, .active-workout input, .active-workout select')
    .evaluateAll((elements) =>
      elements.every((element) => element.getBoundingClientRect().height >= 44),
    )
  expect(touchTargets).toBe(true)

  await page.reload()
  await page.goto(trainingPath())
  await page.getByRole('link', { name: 'Training fortsetzen' }).click()
  await fillAndCompleteSets(page, 'Bankdrücken', '60')
  await fillAndCompleteSets(page, 'Latziehen zur Brust', '45')
  const bench = page.locator('.active-workout__exercise').filter({
    has: page.getByRole('heading', { name: 'Bankdrücken' }),
  })
  await bench.getByLabel('Notiz für Bankdrücken').fill('Kontrollierte Wiederholungen')
  const pulldown = page.locator('.active-workout__exercise').filter({
    has: page.getByRole('heading', { name: 'Latziehen zur Brust' }),
  })
  await pulldown.getByLabel('Griff für Latziehen zur Brust').selectOption('Breit')

  await page.locator('html').evaluate((element) => {
    element.style.fontSize = '200%'
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = ''
  })

  await page.getByRole('button', { name: 'Training abschließen' }).click()
  await page
    .getByRole('dialog', { name: 'Training abschließen?' })
    .getByRole('button', { name: 'Training abschließen' })
    .click()
  await expect(page.getByRole('heading', { name: 'Oberkörper' })).toBeVisible()

  await page.getByRole('button', { name: 'Training bearbeiten' }).click()
  await page.getByLabel('Notiz für Bankdrücken').fill('Historie geprüft')
  await page.getByRole('button', { name: 'Änderungen speichern' }).click()
  await page.getByRole('button', { name: 'Training löschen' }).click()
  await page
    .getByRole('dialog', { name: 'Training wirklich löschen?' })
    .getByRole('button', { name: 'Endgültig löschen' })
    .click()
  await expect(page.getByText('Noch keine abgeschlossenen Trainings vorhanden.')).toBeVisible()
})

test('keeps the cached training catalog and active workout available offline in a production preview', async (
  { context, page },
  testInfo,
) => {
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
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  })
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.active),
      ),
    )
    .toBe(true)
  if (!(await page.evaluate(() => navigator.serviceWorker.controller))) {
    await page.reload()
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  await createUpperBodyTemplate(page)

  await context.setOffline(true)
  await page.goto(trainingPath())
  await expect(page.getByText('Aktives Training')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Oberkörper' })).toBeVisible()
  await page.getByRole('link', { name: 'Übungsbibliothek öffnen' }).click()
  await expect(page.getByRole('heading', { name: 'Übungsbibliothek' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Bankdrücken', exact: true }),
  ).toBeVisible()
})
