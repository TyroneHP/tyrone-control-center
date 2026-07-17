import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getSupabaseClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns one persistent browser client', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project-ref.supabase.co')
    vi.stubEnv(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_placeholder',
    )

    const { getSupabaseClient } = await import('./client')

    expect(getSupabaseClient()).toBe(getSupabaseClient())
  })
})
