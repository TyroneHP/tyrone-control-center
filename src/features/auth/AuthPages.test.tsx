import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from './authApi'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { LoginPage } from './LoginPage'
import { SetupPage } from './SetupPage'
import { UpdatePasswordPage } from './UpdatePasswordPage'

function createApi(): AuthApi {
  return {
    acceptInvitation: vi.fn(),
    bootstrapAdmin: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn(),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOutCurrent: vi.fn(),
    updatePassword: vi.fn().mockResolvedValue(undefined),
  }
}

describe('authentication pages', () => {
  it('shows German validation for an invalid login', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage api={createApi()} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByText('Bitte gib eine gültige E-Mail-Adresse ein.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeInTheDocument()
  })

  it('submits a valid normalized bootstrap address', async () => {
    const user = userEvent.setup()
    const api = createApi()
    render(
      <MemoryRouter>
        <SetupPage api={api} />
      </MemoryRouter>,
    )

    await user.type(
      screen.getByLabelText('Administrator-E-Mail-Adresse'),
      ' Admin@Example.COM ',
    )
    await user.click(
      screen.getByRole('button', { name: 'Einladung anfordern' }),
    )

    expect(api.bootstrapAdmin).toHaveBeenCalledWith('admin@example.com')
    expect(
      await screen.findByText('Die Einladungs-E-Mail wurde versendet.'),
    ).toBeInTheDocument()
  })

  it('enforces the twelve-character password rule', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <UpdatePasswordPage api={createApi()} />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Neues Passwort'), 'zu-kurz')
    await user.type(
      screen.getByLabelText('Passwort wiederholen'),
      'zu-kurz',
    )
    await user.click(screen.getByRole('button', { name: 'Passwort speichern' }))

    expect(
      await screen.findByText('Das Passwort muss mindestens 12 Zeichen lang sein.'),
    ).toBeInTheDocument()
  })

  it('requests a reset for a valid address', async () => {
    const user = userEvent.setup()
    const api = createApi()
    render(
      <MemoryRouter>
        <ForgotPasswordPage api={api} />
      </MemoryRouter>,
    )

    await user.type(
      screen.getByLabelText('E-Mail-Adresse'),
      ' User@Example.COM ',
    )
    await user.click(screen.getByRole('button', { name: 'Link anfordern' }))

    expect(api.requestPasswordReset).toHaveBeenCalledWith('user@example.com')
    expect(
      await screen.findByText(
        'Wenn ein Konto existiert, wurde ein Link zum Zurücksetzen versendet.',
      ),
    ).toBeInTheDocument()
  })
})
