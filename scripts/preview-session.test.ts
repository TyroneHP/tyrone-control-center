import type { Page, Route } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import { installPreviewSession } from '../tests/e2e/previewSession'

const timestamp = '2026-07-17T00:00:00.000Z'

const adminProfile = {
  cleanup_claimed_at: null,
  created_at: timestamp,
  deactivated_at: null,
  deletion_scheduled_at: null,
  display_name: 'Vorschau Admin',
  email: 'admin@example.test',
  id: '11111111-1111-1111-1111-111111111111',
  invitation_id: null,
  role: 'admin',
  status: 'active',
  updated_at: timestamp,
}

const memberProfile = {
  ...adminProfile,
  display_name: 'Vorschau Mitglied',
  email: 'member@example.test',
  id: '22222222-2222-2222-2222-222222222222',
  role: 'member',
}

function request(url: string, method = 'GET', accept = '') {
  return {
    abort: vi.fn(),
    fallback: vi.fn(),
    fulfill: vi.fn(),
    request: () => ({
      headers: () => ({ accept }),
      method: () => method,
      url: () => url,
    }),
  }
}

function expectFulfilledJson(
  route: ReturnType<typeof request>,
  expectedBody: unknown,
) {
  expect(route.fulfill).toHaveBeenCalledOnce()
  const response = route.fulfill.mock.calls[0][0]
  expect(response.status).toBe(200)
  expect(response.contentType).toBe('application/json')
  expect(JSON.parse(response.body)).toEqual(expectedBody)
  expect(route.abort).not.toHaveBeenCalled()
  expect(route.fallback).not.toHaveBeenCalled()
}

describe('preview session request isolation', () => {
  it('handles preview APIs on any host and fails closed for other Supabase APIs', async () => {
    let handler: ((route: Route) => unknown) | undefined
    const page = {
      addInitScript: vi.fn(),
      route: vi.fn((pattern: string, routeHandler: (route: Route) => unknown) => {
        expect(pattern).toBe('**/*')
        handler = routeHandler
      }),
    } as unknown as Page

    await installPreviewSession(page, 'admin')

    expect(page.route).toHaveBeenCalledOnce()
    expect(handler).toBeDefined()

    const singularProfile = request(
      'https://project-ref.supabase.co/rest/v1/profiles?select=*',
      'GET',
      'application/vnd.pgrst.object+json',
    )
    await handler?.(singularProfile as unknown as Route)
    expectFulfilledJson(singularProfile, adminProfile)

    const profiles = request(
      'https://another-project.supabase.co/rest/v1/profiles?select=*',
    )
    await handler?.(profiles as unknown as Route)
    expectFulfilledJson(profiles, [adminProfile, memberProfile])

    const invitations = request(
      'https://project-ref.supabase.co/rest/v1/invitations?select=*',
    )
    await handler?.(invitations as unknown as Route)
    expectFulfilledJson(invitations, [])

    const capacity = request(
      'https://project-ref.supabase.co/rest/v1/rpc/get_account_capacity',
      'POST',
    )
    await handler?.(capacity as unknown as Route)
    expectFulfilledJson(capacity, {
      occupied_slots: 2,
      maximum_slots: 10,
    })

    for (const [method, path] of [
      ['POST', '/rest/v1/profiles'],
      ['PATCH', '/rest/v1/profiles'],
      ['DELETE', '/rest/v1/profiles'],
      ['POST', '/rest/v1/invitations'],
      ['GET', '/rest/v1/rpc/get_account_capacity'],
      ['GET', '/rest/v1/private_table'],
      ['GET', '/rest/v1'],
      ['GET', '/auth/v1'],
      ['GET', '/functions/v1'],
      ['POST', '/auth/v1/token'],
      ['POST', '/functions/v1/manage-user'],
    ]) {
      const blocked = request(`https://project-ref.supabase.co${path}`, method)
      await handler?.(blocked as unknown as Route)
      expect(blocked.abort).toHaveBeenCalledOnce()
      expect(blocked.fulfill).not.toHaveBeenCalled()
      expect(blocked.fallback).not.toHaveBeenCalled()
    }

    const applicationAsset = request('http://127.0.0.1:5173/src/main.tsx')
    await handler?.(applicationAsset as unknown as Route)
    expect(applicationAsset.fallback).toHaveBeenCalledOnce()
    expect(applicationAsset.abort).not.toHaveBeenCalled()
    expect(applicationAsset.fulfill).not.toHaveBeenCalled()
  })
})
