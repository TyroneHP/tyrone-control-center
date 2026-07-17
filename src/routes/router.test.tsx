import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { AuthProvider } from '../features/auth'
import { appRoutes } from './router'

function clientWithoutSession() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  } as unknown as SupabaseClient<Database>
}

function activeClient() {
  const userId = '11111111-1111-1111-1111-111111111111'
  const session = {
    access_token: 'access-token',
    expires_at: 9999999999,
    expires_in: 3600,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user: { id: userId },
  }
  const profile = {
    created_at: '2026-07-17T00:00:00Z',
    cleanup_claimed_at: null,
    deactivated_at: null,
    deletion_scheduled_at: null,
    display_name: 'Tyrone',
    email: 'admin@example.test',
    id: userId,
    invitation_id: '22222222-2222-2222-2222-222222222222',
    role: 'admin',
    status: 'active',
    updated_at: '2026-07-17T00:00:00Z',
  }
  const single = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn().mockReturnValue({ select }),
  } as unknown as SupabaseClient<Database>
}

function renderRoute(path: string, client: SupabaseClient<Database>) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(
    <AuthProvider client={client}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('application routing', () => {
  it('renders the public login route', async () => {
    renderRoute('/login', clientWithoutSession())

    expect(
      await screen.findByRole('heading', { name: 'Willkommen zurück.' }),
    ).toBeInTheDocument()
  })

  it('redirects a protected route to login without a session', async () => {
    renderRoute('/calendar', clientWithoutSession())

    expect(
      await screen.findByRole('heading', { name: 'Willkommen zurück.' }),
    ).toBeInTheDocument()
  })

  it('renders a protected German module placeholder for an active profile', async () => {
    renderRoute('/calendar', activeClient())

    expect(
      await screen.findByRole('heading', { name: 'Kalender' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Grundlage')).toBeInTheDocument()
    expect(
      screen.getByText('Dieses Modul wird in einem späteren Meilenstein aktiviert.'),
    ).toBeInTheDocument()
  })
})
