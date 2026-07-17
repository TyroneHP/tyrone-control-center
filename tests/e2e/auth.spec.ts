import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

const appOrigin = 'http://127.0.0.1:5173'
const supabaseUrl =
  process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const mailpitUrl = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const password = process.env.E2E_PASSWORD ?? 'Foundation-Test-2026!'

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} is required when E2E_LOCAL_SUPABASE=true. See docs/setup-supabase.md.`,
    )
  }
  return value
}

async function invitationLink(email: string) {
  const deadline = Date.now() + 20_000
  const query = encodeURIComponent(`to:"${email}"`)

  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/view/latest.html?query=${query}`)
    if (response.ok) {
      const body = await response.text()
      const href = body.match(
        /href=["']([^"']*\/auth\/v1\/verify[^"']*)/i,
      )?.[1]
      const plain = body.match(
        /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/i,
      )?.[0]
      const link = href ?? plain
      if (link) return link.replaceAll('&amp;', '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Mailpit did not receive an invitation for ${email}.`)
}

async function setInvitedPassword(page: Page, email: string) {
  await page.goto(await invitationLink(email))
  await expect(
    page.getByRole('heading', { name: 'Passwort festlegen' }),
  ).toBeVisible()
  await page.getByLabel('Neues Passwort', { exact: true }).fill(password)
  await page.getByLabel('Passwort wiederholen').fill(password)
  await page.getByRole('button', { name: 'Passwort speichern' }).click()
  await expect(
    page.getByText('Das neue Passwort wurde gespeichert.'),
  ).toBeVisible()
}

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(
    page.getByRole('heading', { name: 'Übersicht' }),
  ).toBeVisible()
}

async function accessToken(page: Page) {
  const token = await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.endsWith('-auth-token')) continue
      const stored = window.localStorage.getItem(key)
      if (!stored) continue
      const value = JSON.parse(stored) as {
        access_token?: string
        currentSession?: { access_token?: string }
      }
      const candidate = value.access_token ?? value.currentSession?.access_token
      if (candidate) return candidate
    }
    return null
  })
  if (!token) throw new Error('No Supabase access token found in browser storage.')
  return token
}

async function invokeFunction(
  request: APIRequestContext,
  functionName: string,
  token: string,
  body: unknown,
) {
  return request.post(`${supabaseUrl}/functions/v1/${functionName}`, {
    data: body,
    headers: {
      apikey: requiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
      authorization: `Bearer ${token}`,
      origin: appOrigin,
    },
  })
}

test.describe('local Supabase invitation lifecycle', () => {
  test.skip(
    process.env.E2E_LOCAL_SUPABASE !== 'true',
    'Requires the local Supabase stack and E2E_LOCAL_SUPABASE=true.',
  )

  test('bootstraps, enforces four slots, denies members, and restores a user', async ({
    browser,
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'The full local account lifecycle runs once in desktop Chromium.',
    )
    test.setTimeout(120_000)

    const adminEmail = requiredEnv('E2E_ADMIN_EMAIL')
    const memberEmails = [
      'member-one@example.test',
      'member-two@example.test',
      'member-three@example.test',
    ]

    await test.step('bootstrap the configured administrator', async () => {
      await page.goto('/setup')
      await page.getByLabel('Administrator-E-Mail-Adresse').fill(adminEmail)
      const [response] = await Promise.all([
        page.waitForResponse((candidate) =>
          candidate.url().endsWith('/functions/v1/bootstrap-admin'),
        ),
        page.getByRole('button', { name: 'Einladung anfordern' }).click(),
      ])
      expect(response.status()).toBe(202)
      await expect(
        page.getByText('Die Einladungs-E-Mail wurde versendet.'),
      ).toBeVisible()
    })

    await test.step('consume the Mailpit invite and sign in', async () => {
      await setInvitedPassword(page, adminEmail)
      await login(page, adminEmail)
    })

    await test.step('invite three members', async () => {
      await page.goto('/settings')
      for (const email of memberEmails) {
        await page.getByLabel('E-Mail-Adresse').fill(email)
        const [response] = await Promise.all([
          page.waitForResponse((candidate) =>
            candidate.url().endsWith('/functions/v1/invite-user'),
          ),
          page.getByRole('button', { name: 'Einladung senden' }).click(),
        ])
        expect(response.status()).toBe(201)
        await expect(page.getByText(email)).toBeVisible()
      }

      await expect(page.getByText('4 von 4')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Einladung senden' }),
      ).toBeDisabled()
    })

    await test.step('reject a fifth reservation server-side', async () => {
      const response = await invokeFunction(
        request,
        'invite-user',
        await accessToken(page),
        { email: 'fifth-account@example.test' },
      )

      expect(response.status()).toBe(409)
      await expect(response.json()).resolves.toMatchObject({
        code: 'ACCOUNT_CAPACITY_REACHED',
      })
    })

    const memberContext = await browser.newContext({ baseURL: appOrigin })
    const memberPage = await memberContext.newPage()
    try {
      await test.step('deny administrator controls to a member', async () => {
        await setInvitedPassword(memberPage, memberEmails[0])
        await login(memberPage, memberEmails[0])
        await memberPage.goto('/settings')
        await expect(
          memberPage.getByText(
            'Diese Kontoverwaltung ist nur für Administratoren verfügbar.',
          ),
        ).toBeVisible()

        const response = await invokeFunction(
          request,
          'manage-user',
          await accessToken(memberPage),
          {
            action: 'deactivate',
            userId: '33333333-3333-3333-3333-333333333333',
          },
        )
        expect(response.status()).toBe(403)
        await expect(response.json()).resolves.toMatchObject({
          code: 'ADMIN_REQUIRED',
        })
      })

      await test.step('deactivate, deny the live session, and restore the member', async () => {
        await page.goto('/settings')
        const memberRow = page
          .locator('.account-row')
          .filter({ hasText: memberEmails[0] })
        await memberRow
          .getByRole('button', {
            name: `Konto von ${memberEmails[0]} deaktivieren`,
          })
          .click()
        await page
          .getByRole('button', { name: 'Deaktivierung bestätigen' })
          .click()
        await expect(memberRow.getByText('Deaktiviert')).toBeVisible()

        await memberPage.reload()
        await expect(
          memberPage.getByText('Dieses Benutzerkonto ist deaktiviert.'),
        ).toBeVisible()
        await expect(
          memberPage.getByRole('heading', { name: 'Anmelden' }),
        ).toBeVisible()

        await memberRow
          .getByRole('button', { name: 'Wiederherstellen' })
          .click()
        await expect(memberRow.getByText('Aktiv')).toBeVisible()
        await login(memberPage, memberEmails[0])
      })
    } finally {
      await memberContext.close()
    }
  })
})
