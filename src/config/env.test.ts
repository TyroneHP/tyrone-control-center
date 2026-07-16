import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './env'

describe('parsePublicEnv', () => {
  it('rejects missing Supabase configuration', () => {
    expect(() => parsePublicEnv({ BASE_URL: '/' })).toThrow()
  })

  it('accepts valid public configuration', () => {
    expect(
      parsePublicEnv({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
        BASE_URL: '/tyrone-control-center/',
      }),
    ).toEqual({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
      BASE_URL: '/tyrone-control-center/',
    })
  })
})
