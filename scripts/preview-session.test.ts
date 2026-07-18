import type { Page, Route } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import { installPreviewSession } from '../tests/e2e/previewSession'

function request(url: string, accept = '') {
  return {
    abort: vi.fn(),
    fallback: vi.fn(),
    fulfill: vi.fn(),
    request: () => ({
      headers: () => ({ accept }),
      url: () => url,
    }),
  } as unknown as Route
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

    const profiles = request(
      'https://project-ref.supabase.co/rest/v1/profiles?select=*',
      'application/json',
    )
    await handler?.(profiles)
    expect(profiles.fulfill).toHaveBeenCalledOnce()

    for (const url of [
      'https://project-ref.supabase.co/rest/v1/private_table',
      'https://project-ref.supabase.co/auth/v1/token',
      'https://project-ref.supabase.co/functions/v1/manage-user',
    ]) {
      const blocked = request(url)
      await handler?.(blocked)
      expect(blocked.abort).toHaveBeenCalledOnce()
      expect(blocked.fallback).not.toHaveBeenCalled()
    }

    const applicationAsset = request('http://127.0.0.1:5173/src/main.tsx')
    await handler?.(applicationAsset)
    expect(applicationAsset.fallback).toHaveBeenCalledOnce()
  })
})
