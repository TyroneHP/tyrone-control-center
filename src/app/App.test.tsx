import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { DEVICE_PREFERENCES_KEY } from '../preferences/devicePreferences'
import { useDevicePreferences } from '../preferences/useDevicePreferences'
import { App } from './App'
import { appRoutes } from '../routes/router'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

function PreferenceFailureTrigger() {
  const { setTheme, theme } = useDevicePreferences()

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Darstellung speichern
    </button>
  )
}

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

    await screen.findByText('CoreGrid')
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
      await screen.findByText('CoreGrid'),
    ).toBeInTheDocument()
  })

  it('keeps live preferences and warns when the browser storage getter is unavailable', async () => {
    const localStorageGetter = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('Storage blocked')
      })
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    } as unknown as SupabaseClient<Database>
    const router = createMemoryRouter(
      [{ element: <PreferenceFailureTrigger />, path: '/' }],
      { initialEntries: ['/'] },
    )

    try {
      expect(() =>
        render(
          <App
            authClient={client}
            queryClient={new QueryClient()}
            router={router}
          />,
        ),
      ).not.toThrow()
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      fireEvent.click(
        screen.getByRole('button', { name: 'Darstellung speichern' }),
      )
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
      expect(
        await screen.findByRole('status', {
          name: /Warnung: Die Einstellung konnte auf diesem Ger.t nicht dauerhaft gespeichert werden\./,
        }),
      ).toBeInTheDocument()
    } finally {
      localStorageGetter.mockRestore()
    }
  })

  it('shows a warning when device preferences cannot be persisted', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage unavailable')
      })
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    } as unknown as SupabaseClient<Database>
    const router = createMemoryRouter(
      [{ element: <PreferenceFailureTrigger />, path: '/' }],
      { initialEntries: ['/'] },
    )

    render(<App authClient={client} queryClient={new QueryClient()} router={router} />)
    fireEvent.click(screen.getByRole('button', { name: 'Darstellung speichern' }))

    expect(
      await screen.findByRole('status', {
        name: /Warnung: Die Einstellung konnte auf diesem Gerät nicht dauerhaft gespeichert werden\./,
      }),
    ).toBeInTheDocument()
    setItem.mockRestore()
  })
})
