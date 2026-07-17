import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { createSettingsApi } from './settingsApi'

describe('settings API errors', () => {
  it('loads the authoritative database capacity with the account lists', async () => {
    const order = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const single = vi.fn().mockResolvedValue({
      data: { maximum_slots: 10, occupied_slots: 9 },
      error: null,
    })
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ order }),
      }),
      rpc: vi.fn().mockReturnValue({ single }),
    }
    const api = createSettingsApi(
      client as unknown as SupabaseClient<Database>,
    )

    await expect(api.listAccounts()).resolves.toMatchObject({
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [],
    })
    expect(client.rpc).toHaveBeenCalledWith('get_account_capacity')
    expect(single).toHaveBeenCalledOnce()
  })

  it('preserves safe Edge Function error codes from non-success responses', async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: {
            context: new Response(
              JSON.stringify({
                code: 'ACCOUNT_CAPACITY_REACHED',
                message:
                  'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
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
