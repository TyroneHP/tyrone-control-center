import type { Page, Route } from '@playwright/test'

export type PreviewRole = 'admin' | 'member'

const timestamp = '2026-07-17T00:00:00.000Z'
const adminId = '11111111-1111-1111-1111-111111111111'
const memberId = '22222222-2222-2222-2222-222222222222'

function createProfile(role: PreviewRole) {
  return {
    cleanup_claimed_at: null,
    created_at: timestamp,
    deactivated_at: null,
    deletion_scheduled_at: null,
    display_name: role === 'admin' ? 'Vorschau Admin' : 'Vorschau Mitglied',
    email: `${role}@example.test`,
    id: role === 'admin' ? adminId : memberId,
    invitation_id: null,
    role,
    status: 'active',
    updated_at: timestamp,
  }
}

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  })
}

export async function installPreviewSession(
  page: Page,
  role: PreviewRole,
): Promise<void> {
  const currentProfile = createProfile(role)
  const profiles = [createProfile('admin'), createProfile('member')]

  await page.addInitScript(
    ({ email, id, now }) => {
      window.localStorage.setItem(
        'sb-127-auth-token',
        JSON.stringify({
          access_token: 'preview-access-token-placeholder',
          expires_at: 4_102_444_800,
          expires_in: 3600,
          refresh_token: 'preview-refresh-token-placeholder',
          token_type: 'bearer',
          user: {
            app_metadata: { provider: 'email', providers: ['email'] },
            aud: 'authenticated',
            created_at: now,
            email,
            email_confirmed_at: now,
            id,
            role: 'authenticated',
            updated_at: now,
            user_metadata: {},
          },
        }),
      )
    },
    { email: currentProfile.email, id: currentProfile.id, now: timestamp },
  )

  await page.route('**/*', (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname

    if (method === 'GET' && path === '/rest/v1/profiles') {
      const accept = request.headers().accept ?? ''
      return fulfillJson(
        route,
        accept.includes('application/vnd.pgrst.object+json')
          ? currentProfile
          : profiles,
      )
    }
    if (method === 'GET' && path === '/rest/v1/invitations') {
      return fulfillJson(route, [])
    }
    if (method === 'POST' && path === '/rest/v1/rpc/get_account_capacity') {
      return fulfillJson(route, { occupied_slots: 2, maximum_slots: 10 })
    }
    if (
      path === '/rest/v1' ||
      path.startsWith('/rest/v1/') ||
      path === '/auth/v1' ||
      path.startsWith('/auth/v1/') ||
      path === '/functions/v1' ||
      path.startsWith('/functions/v1/')
    ) {
      return route.abort('blockedbyclient')
    }

    return route.fallback()
  })
}
