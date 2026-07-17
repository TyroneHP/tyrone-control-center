import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { createSettingsApi } from './settingsApi'

describe('settings API errors', () => {
  it('preserves safe Edge Function error codes from non-success responses', async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: {
            context: new Response(
              JSON.stringify({
                code: 'ACCOUNT_CAPACITY_REACHED',
                message: 'Alle vier Kontoplätze sind belegt.',
              }),
              { status: 409 },
            ),
          },
        }),
      },
    }
    const api = createSettingsApi(
      client as unknown as SupabaseClient<Database>,
    )

    await expect(api.inviteUser('member@example.test')).rejects.toEqual(
      expect.objectContaining({
        code: 'ACCOUNT_CAPACITY_REACHED',
      }),
    )
  })
})
