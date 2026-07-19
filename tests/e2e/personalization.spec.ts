import { expect, test, type Locator } from '@playwright/test'
import { installPreviewSession } from './previewSession'

async function expectNoInlineOverflow(sidebar: Locator) {
  const dimensions = await sidebar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))

  expect(
    dimensions.scrollWidth,
    `sidebar dimensions: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function expectControlInsideSidebar(
  control: Locator,
  minimumClearance = 0,
) {
  const geometry = await control.evaluate((element) => {
    const sidebar = element.closest<HTMLElement>('.app-shell__sidebar')
    if (!sidebar) throw new Error('Expected control inside desktop sidebar')

    const controlRect = element.getBoundingClientRect()
    const sidebarRect = sidebar.getBoundingClientRect()
    const scrollportLeft = sidebarRect.left + sidebar.clientLeft
    const scrollportTop = sidebarRect.top + sidebar.clientTop

    return {
      bottom: scrollportTop + sidebar.clientHeight - controlRect.bottom,
      left: controlRect.left - scrollportLeft,
      right: scrollportLeft + sidebar.clientWidth - controlRect.right,
      top: controlRect.top - scrollportTop,
    }
  })

  for (const clearance of Object.values(geometry)) {
    expect(clearance).toBeGreaterThanOrEqual(minimumClearance)
  }
}

async function expectFocusedControlOutlineInsideSidebar(control: Locator) {
  await control.focus()
  await expect(control).toBeFocused()
  const outlineClearance = await control.evaluate((element) => {
    const styles = getComputedStyle(element)
    return (
      Number.parseFloat(styles.outlineWidth) +
      Number.parseFloat(styles.outlineOffset)
    )
  })

  expect(outlineClearance).toBe(6)
  await expectControlInsideSidebar(control, outlineClearance)
}

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

test('forces compact desktop navigation between 768 and 1099 pixels', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.setViewportSize({ height: 800, width: 900 })
  await installPreviewSession(page, 'member')
  await page.goto('/settings')

  const sidebar = page.locator('.app-shell__sidebar')
  await expect(sidebar).toBeVisible()
  await expect(sidebar).toHaveAttribute('data-forced-compact', 'true')
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expect(
    sidebar.getByRole('button', { name: /Seitenleiste/ }),
  ).toHaveCount(0)

  await page.setViewportSize({ height: 800, width: 1200 })
  await expect(sidebar).toHaveAttribute('data-forced-compact', 'false')
  await expect(sidebar).toHaveAttribute('data-collapsed', 'false')
  await expect(
    sidebar.getByRole('button', { name: 'Seitenleiste einklappen' }),
  ).toBeVisible()
})

test('keeps desktop sidebar controls reachable at short heights with large text', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.setViewportSize({ height: 360, width: 1280 })
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = '200%'
  })

  const sidebar = page.locator('.app-shell__sidebar')
  const main = page.getByRole('main')
  await expect
    .poll(() =>
      sidebar.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true)
  await expectNoInlineOverflow(sidebar)

  const documentScrollBeforeSidebarScroll = await page.evaluate(() => window.scrollY)
  await sidebar.evaluate((element) => {
    element.scrollTo({ left: 0, top: element.scrollHeight })
  })

  const settingsLink = sidebar.getByRole('link', { name: 'Einstellungen' })
  const toggle = sidebar.getByRole('button', {
    name: 'Seitenleiste einklappen',
  })
  await expectControlInsideSidebar(settingsLink)
  await expectControlInsideSidebar(toggle)
  await expectFocusedControlOutlineInsideSidebar(toggle)
  expect(await page.evaluate(() => window.scrollY)).toBe(
    documentScrollBeforeSidebarScroll,
  )

  await toggle.click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expect(sidebar).toHaveCSS('width', '76px')
  await sidebar.evaluate((element) => {
    element.scrollTo({ left: 0, top: element.scrollHeight })
  })
  await expectNoInlineOverflow(sidebar)
  const collapsedToggle = sidebar.getByRole('button', {
    name: 'Seitenleiste ausklappen',
  })
  await expectControlInsideSidebar(settingsLink)
  await expectControlInsideSidebar(collapsedToggle)
  await expectFocusedControlOutlineInsideSidebar(collapsedToggle)

  const fixedSidebarBeforeMainScroll = await sidebar.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    scrollTop: element.scrollTop,
    top: element.getBoundingClientRect().top,
  }))
  const maximumDocumentScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  expect(maximumDocumentScroll).toBeGreaterThan(0)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const fixedSidebarAfterMainScroll = await sidebar.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    scrollTop: element.scrollTop,
    top: element.getBoundingClientRect().top,
  }))
  expect(fixedSidebarAfterMainScroll).toEqual(fixedSidebarBeforeMainScroll)

  await main.getByRole('switch', { name: 'Dunkelmodus' }).scrollIntoViewIfNeeded()
  await expect(main.getByRole('switch', { name: 'Dunkelmodus' })).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('persists configured mobile tab order and exposes the complete More menu', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByLabel('Tab 2', { exact: true }).selectOption('files')
  await page.getByRole('button', { name: 'Tab 2 nach rechts' }).click()
  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  const tabLabels = mobile.locator('.mobile-navigation__bar > * > span')
  await expect(tabLabels).toHaveText([
    '\u00dcbersicht',
    'Kalender',
    'Training',
    'Dateien',
    'Mehr',
  ])
  for (let index = 0; index < 5; index += 1) {
    await expect(tabLabels.nth(index)).toBeVisible()
  }

  await page.reload()
  await expect(tabLabels).toHaveText([
    '\u00dcbersicht',
    'Kalender',
    'Training',
    'Dateien',
    'Mehr',
  ])
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

test('resets a cancelled mobile sheet gesture without overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')

  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await mobile.getByRole('button', { name: 'Mehr' }).click()
  const dialog = page.getByRole('dialog', { name: 'Alle Bereiche' })
  const handle = dialog.getByTestId('responsive-dialog-drag-handle')
  await expect(handle).toHaveCSS('touch-action', 'none')

  const contentPadding = await dialog
    .locator('.responsive-dialog__content')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom))
  expect(contentPadding).toBeGreaterThanOrEqual(24)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  const dispatchPointer = async (
    type: 'pointercancel' | 'pointerdown' | 'pointermove' | 'pointerup',
    init: { clientX: number; clientY: number; pointerId: number },
  ) => {
    await handle.evaluate(
      (element, event) => {
        element.dispatchEvent(
          new PointerEvent(event.type, {
            bubbles: true,
            clientX: event.clientX,
            clientY: event.clientY,
            pointerId: event.pointerId,
            pointerType: 'touch',
          }),
        )
      },
      { ...init, type },
    )
  }

  await dispatchPointer('pointerdown', { clientX: 10, clientY: 10, pointerId: 7 })
  await dispatchPointer('pointermove', { clientX: 12, clientY: 90, pointerId: 7 })
  await expect
    .poll(() =>
      dialog.evaluate((element) =>
        element.style.getPropertyValue('--responsive-dialog-drag-y'),
      ),
    )
    .toBe('80px')
  await dispatchPointer('pointercancel', { clientX: 12, clientY: 90, pointerId: 7 })
  await expect
    .poll(() =>
      dialog.evaluate((element) =>
        element.style.getPropertyValue('--responsive-dialog-drag-y'),
      ),
    )
    .toBe('')

  await dispatchPointer('pointerdown', { clientX: 20, clientY: 20, pointerId: 8 })
  await dispatchPointer('pointermove', { clientX: 22, clientY: 95, pointerId: 8 })
  await dispatchPointer('pointerup', { clientX: 22, clientY: 95, pointerId: 8 })
  await expect(dialog).toBeHidden()
})
