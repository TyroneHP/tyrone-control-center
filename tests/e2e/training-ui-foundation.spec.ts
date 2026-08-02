import { expect, test, type Locator, type Page } from '@playwright/test'
import { installPreviewSession } from './previewSession'

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

async function expectMinimumTouchTargets(targets: Locator) {
  await expect(targets.first()).toBeVisible()
  await expect
    .poll(() =>
      targets.evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return { height: rect.height, width: rect.width }
          })
          .filter(({ height, width }) => height < 44 || width < 44),
      ),
    )
    .toEqual([])
}

async function expectAllVisibleTrainingControlsMeetTouchTargetContract(page: Page) {
  await expectMinimumTouchTargets(
    page.locator('.training-demo :is(a, button, input, textarea, [role="button"]), .responsive-dialog :is(a, button, input, textarea, [role="button"])'),
  )
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

async function expectAboveMobileNavigation(page: Page, floating: Locator) {
  const navigation = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await expect(floating).toBeVisible()
  await expect(navigation).toBeVisible()
  const [floatingBox, navigationBox] = await Promise.all([
    floating.boundingBox(),
    navigation.boundingBox(),
  ])

  expect(floatingBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect((floatingBox?.y ?? Infinity) + (floatingBox?.height ?? Infinity))
    .toBeLessThanOrEqual(navigationBox?.y ?? 0)
}

test('creates a mock plan, starts it, edits a set and finishes on iPhone WebKit', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  test.skip(
    testInfo.project.name !== 'iphone-webkit',
    'Runs once in iPhone WebKit.',
  )

  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await expectNoHorizontalOverflow(page)
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await expectAboveMobileNavigation(
    page,
    page.getByRole('button', { name: 'Schnellstart Training' }),
  )
  await page.getByRole('button', { name: 'Schnellstart Training' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Dialog schließen' }).click()
  await page.getByRole('link', { name: 'Bibliothek' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Filter öffnen' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Dialog schließen' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()

  await page.getByRole('button', { name: 'Training fortsetzen' }).click()
  await page.getByRole('button', { name: 'Training verwerfen' }).click()
  await page
    .getByRole('dialog', { name: 'Training wirklich verwerfen?' })
    .getByRole('button', { name: 'Endgültig verwerfen' })
    .click()
  await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))

  await page.getByRole('button', { name: /Freies Training/ }).click()
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click()
  await page.getByRole('button', { exact: true, name: 'Bankdrücken hinzufügen' }).click()
  await page.getByLabel('Satz 1 Gewicht').fill('50')
  await page.getByLabel('Satz 1 Wiederholungen').fill('10')
  await page.getByLabel('Satz 1 abgeschlossen').click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Training verwerfen' }).click()
  await page
    .getByRole('dialog', { name: 'Training wirklich verwerfen?' })
    .getByRole('button', { name: 'Endgültig verwerfen' })
    .click()

  await page.getByRole('link', { name: 'Pläne' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByLabel('Planname').fill('Mobil-Test')
  await page.getByRole('button', { name: 'Montag' }).click()
  await page.getByRole('button', { name: 'Weiter zu Übungen' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  const selectBenchPress = page.getByRole('button', {
    exact: true,
    name: 'Bankdrücken auswählen',
  })
  await expectMinimumTouchTargets(selectBenchPress)
  await selectBenchPress.click()
  await expectNoHorizontalOverflow(page)
  await expectMinimumTouchTargets(
    page.locator('.training-sticky-action button'),
  )
  await expectAboveMobileNavigation(
    page,
    page.getByRole('button', { name: 'Weiter zu Anpassen' }),
  )
  await page.getByRole('button', { name: 'Weiter zu Anpassen' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Weiter zu Vorschau' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Plan speichern' }).click()
  await page.getByRole('button', { name: 'Plan öffnen: Mobil-Test' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Planaktionen öffnen' }).click()
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await page.getByRole('button', { name: 'Dialog schließen' }).click()
  await page.getByRole('button', { name: 'Training starten' }).click()
  await expect(page.getByRole('heading', { name: 'Mobil-Test' })).toBeVisible()
  await page.getByLabel('Satz 1 Gewicht').fill('60')
  await page.getByLabel('Satz 1 abgeschlossen').click()
  await expect(page.getByLabel('Satz 1 abgeschlossen')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expectNoHorizontalOverflow(page)
  await expectMinimumTouchTargets(
    page.locator('.training-set-row input, .training-set-row__completion'),
  )
  await expectAllVisibleTrainingControlsMeetTouchTargetContract(page)
  await expectAboveMobileNavigation(
    page,
    page.getByRole('button', { name: 'Training abschließen' }),
  )
  await page.getByRole('button', { name: 'Training abschließen' }).click()
  await page
    .getByRole('dialog', { name: 'Training abschließen?' })
    .getByRole('button', { name: 'Training abschließen' })
    .click()
  await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))
})

test('keeps desktop navigation visible on the training dashboard', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The desktop sidebar check runs once in desktop Chromium.',
  )
  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await expect(
    page.getByRole('navigation', { name: 'Desktop-Navigation' }),
  ).toBeVisible()
})

for (const oldPath of [
  '/history',
  '/progress',
  '/progress/bodyweight',
]) {
  test(`redirects legacy route ${oldPath} to dashboard`, async ({ page }) => {
    await installPreviewSession(page, 'member')
    await page.goto(trainingPath(oldPath))
    await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))
  })
}
