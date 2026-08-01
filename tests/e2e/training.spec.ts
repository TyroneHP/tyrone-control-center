import { expect, test, type Page } from '@playwright/test'
import { installPreviewSession } from './previewSession'

async function addExercise(page: Page, name: string) {
  const openPicker = page.getByRole('button', { name: 'Übung hinzufügen' })
  await openPicker.click()
  const picker = page.getByRole('dialog', { name: 'Übung auswählen' })
  await expect(picker).toBeVisible()
  await expectTouchTargets(page, '.exercise-picker__list button')
  const detailsButton = picker.getByRole('button', {
    exact: true,
    name: `Details zu ${name}`,
  })
  await expect
    .poll(async () => {
      await detailsButton.focus()
      return detailsButton.evaluate((element) => document.activeElement === element)
    })
    .toBe(true)
  await detailsButton.click()
  const details = page.locator('[role="dialog"]', {
    has: page.locator('.responsive-dialog__header > h2', { hasText: name }),
  })
  await expect(details).toBeVisible()
  await expectTouchTargets(page, '[role="dialog"] .responsive-dialog__actions button')
  await details.getByRole('button', { name: 'Zum Training hinzufügen' }).click()
  await expect(details).toBeHidden()
  await expect(picker).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.body.style.overflow === 'hidden' ||
          document.documentElement.style.overflow === 'hidden',
      ),
    )
    .toBe(false)
}

async function createUpperBodyTemplate(page: Page) {
  await page.goto(trainingPath('/templates/new'))
  await expect(page.getByRole('heading', { name: 'Trainingsplan erstellen' })).toBeVisible()
  await expectTouchTargets(
    page,
    '.workout-template-editor button, .workout-template-editor input, .workout-template-editor select, .workout-template-editor textarea',
  )
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

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    fits: document.documentElement.scrollWidth <= window.innerWidth,
    offenders: Array.from(document.querySelectorAll('body *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < 0 || rect.right > window.innerWidth
      })
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          className: element.className,
          left: rect.left,
          right: rect.right,
          tagName: element.tagName,
          width: rect.width,
        }
      }),
    viewportWidth: window.innerWidth,
  }))
  expect(layout.fits, JSON.stringify(layout)).toBe(true)
}

async function expectTouchTargets(page: Page, selector: string) {
  const targets = page.locator(selector)
  await expect(targets.first()).toBeVisible()
  await expect
    .poll(async () => {
      const measurements = await targets.evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => ({
            height: element.getBoundingClientRect().height,
            label:
              element.getAttribute('aria-label') ??
              element.getAttribute('name') ??
              element.textContent?.trim() ??
              element.tagName,
            tagName: element.tagName,
          })),
      )
      return measurements.filter(({ height }) => height < 44)
    })
    .toEqual([])
}

async function enableTwoHundredPercentTextZoom(page: Page) {
  const root = page.locator('html')
  await root.evaluate((element) => {
    element.style.fontSize = '200%'
  })
  await expect(root).toHaveCSS('font-size', '32px')
}

test('completes the iPhone WebKit offline workout flow without overflow', async (
  { page },
  testInfo,
) => {
  test.setTimeout(60_000)
  test.skip(
    testInfo.project.name !== 'iphone-webkit',
    'The prescribed touch workflow runs once in iPhone WebKit.',
  )
  await installPreviewSession(page, 'member')
  await createUpperBodyTemplate(page)

  await expect(page.getByText('Ziel: 3 Sätze mit 8–12 Wiederholungen')).toHaveCount(2)
  await expect(page.locator('.active-workout__actions')).toHaveCSS('position', 'sticky')
  await expectTouchTargets(
    page,
    '.active-workout button, .active-workout input, .active-workout select, .active-workout textarea, .active-workout a[href]',
  )

  await fillAndCompleteSets(page, 'Bankdrücken', '60')
  await fillAndCompleteSets(page, 'Latziehen zur Brust', '45')

  await page.reload()
  await page.goto(trainingPath())
  await page.getByRole('link', { name: 'Training fortsetzen' }).click()
  const bench = page.locator('.active-workout__exercise').filter({
    has: page.getByRole('heading', { name: 'Bankdrücken' }),
  })
  for (const setNumber of [1, 2, 3]) {
    await expect(bench.getByLabel(`Satz ${setNumber} Gewicht`)).toHaveValue('60')
    await expect(bench.getByLabel(`Satz ${setNumber} Wiederholungen`)).toHaveValue('10')
    await expect(bench.getByLabel(`Satz ${setNumber} abgeschlossen`)).toBeChecked()
  }
  const pulldown = page.locator('.active-workout__exercise').filter({
    has: page.getByRole('heading', { name: 'Latziehen zur Brust' }),
  })
  for (const setNumber of [1, 2, 3]) {
    await expect(pulldown.getByLabel(`Satz ${setNumber} Gewicht`)).toHaveValue('45')
    await expect(pulldown.getByLabel(`Satz ${setNumber} Wiederholungen`)).toHaveValue('10')
    await expect(pulldown.getByLabel(`Satz ${setNumber} abgeschlossen`)).toBeChecked()
  }
  await bench.getByLabel('Notiz für Bankdrücken').fill('Kontrollierte Wiederholungen')
  await pulldown.getByLabel('Griff für Latziehen zur Brust').selectOption('Breit')

  await enableTwoHundredPercentTextZoom(page)
  await expectNoHorizontalOverflow(page)
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = ''
  })

  const finishWorkout = page.getByRole('button', { name: 'Training abschließen' })
  await finishWorkout.scrollIntoViewIfNeeded()
  const stickyLayout = await page.evaluate(() => {
    const actions = document.querySelector('.active-workout__actions')
    const navigation = document.querySelector('.mobile-navigation')
    if (!actions || !navigation) return null
    const actionRect = actions.getBoundingClientRect()
    const navigationRect = navigation.getBoundingClientRect()
    return {
      actionBottom: actionRect.bottom,
      navigationTop: navigationRect.top,
    }
  })
  expect(
    stickyLayout && stickyLayout.actionBottom <= stickyLayout.navigationTop,
    JSON.stringify(stickyLayout),
  ).toBe(true)
  await finishWorkout.click()
  await page
    .getByRole('dialog', { name: 'Training abschließen?' })
    .getByRole('button', { name: 'Training abschließen' })
    .click()
  await expect(page).toHaveURL(/\/training\/history\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Training bearbeiten' })).toBeVisible()
  const completedWorkoutPath = new URL(page.url()).pathname
  await expectTouchTargets(page, '.completed-workout button, .completed-workout a[href]')
  await enableTwoHundredPercentTextZoom(page)
  await expectNoHorizontalOverflow(page)
  await page.goto(trainingPath('/history'))
  await expect(page.getByRole('heading', { name: 'Trainingsverlauf' })).toBeVisible()
  await expectTouchTargets(page, '.workout-history button, .workout-history a[href]')
  await enableTwoHundredPercentTextZoom(page)
  await expectNoHorizontalOverflow(page)
  await page.goto(trainingPath('/library'))
  await expect(page.getByRole('heading', { name: 'Übungsbibliothek' })).toBeVisible()
  await expectTouchTargets(
    page,
    '.exercise-library button, .exercise-library input, .exercise-library select, .exercise-library textarea, .exercise-library a[href]',
  )
  await enableTwoHundredPercentTextZoom(page)
  await expectNoHorizontalOverflow(page)
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = ''
  })
  await page.goto(completedWorkoutPath)

  await page.getByRole('button', { name: 'Training bearbeiten' }).click()
  await expectTouchTargets(
    page,
    '.completed-workout button, .completed-workout input, .completed-workout select, .completed-workout textarea, .completed-workout a[href]',
  )
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
