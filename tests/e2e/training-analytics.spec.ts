import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

for (const oldPath of [
  '/history/previous-session',
  '/progress/exercises?exercise=bench-press',
  '/progress/records',
  '/progress/muscles',
]) {
  test(`redirects legacy analytics route ${oldPath} to dashboard`, async ({ page }) => {
    await installPreviewSession(page, 'member')
    await page.goto(trainingPath(oldPath))
    await expect(page).toHaveURL(new RegExp(`${trainingPath()}$`))
  })
}
