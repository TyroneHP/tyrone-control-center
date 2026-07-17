import { render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { App } from './App'
import { appRoutes } from '../routes/router'

describe('App', () => {
  it('renders the routed application providers', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    } as unknown as SupabaseClient<Database>
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/login'] })

    render(
      <App
        authClient={client}
        queryClient={new QueryClient()}
        router={router}
      />,
    )

    expect(
      await screen.findByText('Tyrone Control Center'),
    ).toBeInTheDocument()
  })
})
