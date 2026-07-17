import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button, FormField, InlineAlert } from '../../design-system'
import { AuthPageLayout } from './AuthPageLayout'
import { getAuthApi, type AuthApi } from './authApi'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage({ api }: { api?: AuthApi }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function submit(values: LoginValues) {
    setServerError(null)
    try {
      await (api ?? getAuthApi()).signIn(values)
      navigate('/', { replace: true })
    } catch {
      setServerError('Anmeldung fehlgeschlagen. Prüfe deine Zugangsdaten.')
    }
  }

  return (
    <AuthPageLayout
      description="Dein privater Bereich für Planung, Projekte und persönliche Organisation."
      title="Willkommen zurück."
    >
      <h2>Anmelden</h2>
      <p className="auth-card__copy">Melde dich mit deinem eingeladenen Konto an.</p>
      {serverError ? <InlineAlert variant="error">{serverError}</InlineAlert> : null}
      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField
          error={form.formState.errors.email?.message}
          htmlFor="login-email"
          label="E-Mail-Adresse"
        >
          <input
            autoComplete="email"
            className="auth-input"
            id="login-email"
            type="email"
            {...form.register('email')}
          />
        </FormField>
        <FormField
          error={form.formState.errors.password?.message}
          htmlFor="login-password"
          label="Passwort"
        >
          <input
            autoComplete="current-password"
            className="auth-input"
            id="login-password"
            type="password"
            {...form.register('password')}
          />
        </FormField>
        <Button isLoading={form.formState.isSubmitting} type="submit">
          Anmelden
        </Button>
      </form>
      <div className="auth-card__links">
        <Link to="/forgot-password">Passwort vergessen?</Link>
        <Link to="/setup">Ersteinrichtung</Link>
      </div>
    </AuthPageLayout>
  )
}
