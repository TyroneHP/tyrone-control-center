import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authContextValue'

type Profile = Database['public']['Tables']['profiles']['Row']

const session = {
  access_token: 'access-token',
  expires_at: 9999999999,
  expires_in: 3600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user: { id: '11111111-1111-1111-1111-111111111111' },
}

function profile(status: Profile['status']): Profile {
  return {
    created_at: '2026-07-17T00:00:00Z',
    deactivated_at: status === 'deactivated' ? '2026-07-17T00:00:00Z' : null,
    deletion_scheduled_at:
      status === 'deactivated' ? '2026-08-16T00:00:00Z' : null,
    display_name: null,
    email: 'admin@example.test',
    id: session.user.id,
    invitation_id: '22222222-2222-2222-2222-222222222222',
    role: 'admin',
    status,
    updated_at: '2026-07-17T00:00:00Z',
  }
}

function createClient(initialProfile: Profile) {
  const single = vi.fn().mockResolvedValue({ data: initialProfile, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  let authCallback: ((event: string, nextSession: typeof session | null) => void) | undefined
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
      onAuthStateChange: vi.fn((callback) => {
        authCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({ select }),
    rpc: vi.fn().mockResolvedValue({ data: profile('active'), error: null }),
  }

  return { client, emit: () => authCallback?.('SIGNED_IN', session) }
}

function Probe() {
  const { profile: currentProfile, status } = useAuth()
  return <div>{`${status}:${currentProfile?.status ?? 'none'}`}</div>
}

describe('AuthProvider', () => {
  it('accepts an invited profile exactly once', async () => {
    const { client, emit } = createClient(profile('invited'))

    render(
      <AuthProvider client={client as unknown as SupabaseClient<Database>}>
        <Probe />
      </AuthProvider>,
    )

    await screen.findByText('authenticated:active')
    emit()
    await waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(1))
  })

  it('signs out a deactivated profile locally', async () => {
    const { client } = createClient(profile('deactivated'))

    render(
      <AuthProvider client={client as unknown as SupabaseClient<Database>}>
        <Probe />
      </AuthProvider>,
    )

    await screen.findByText('unauthenticated:none')
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
