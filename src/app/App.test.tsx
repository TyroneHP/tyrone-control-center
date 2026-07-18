import { render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { DEVICE_PREFERENCES_KEY } from '../preferences/devicePreferences'
import { App } from './App'
import { appRoutes } from '../routes/router'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

describe('App', () => {
  it('initializes device preferences from browser storage', async () => {
    window.localStorage.setItem(
      DEVICE_PREFERENCES_KEY,
      JSON.stringify({
        desktopSidebar: 'expanded',
        mobileTabs: ['calendar', 'tasks', 'training'],
        theme: 'light',
      }),
    )
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

    await screen.findByText('Tyrone Control Center')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

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
