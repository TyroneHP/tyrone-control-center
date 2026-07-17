import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

describe('ProtectedRoute', () => {
  it('redirects a visitor without session to the login page', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    }

    render(
      <AuthProvider client={client as unknown as SupabaseClient<Database>}>
        <MemoryRouter initialEntries={['/geschuetzt']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/geschuetzt" element={<h1>Privater Bereich</h1>} />
            </Route>
            <Route path="/login" element={<h1>Anmeldung</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await screen.findByRole('heading', { name: 'Anmeldung' })
  })
})
