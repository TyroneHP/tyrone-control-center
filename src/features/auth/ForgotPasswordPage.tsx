import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button, FormField, InlineAlert } from '../../design-system'
import { AuthPageLayout } from './AuthPageLayout'
import { getAuthApi, type AuthApi } from './authApi'
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from './schemas'

export function ForgotPasswordPage({ api }: { api?: AuthApi }) {
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function submit({ email }: ForgotPasswordValues) {
    setFailed(false)
    try {
      await (api ?? getAuthApi()).requestPasswordReset(email)
      setSent(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <AuthPageLayout
      description="Fordere einen zeitlich begrenzten Link an und lege anschließend ein neues Passwort fest."
      title="Zugang wiederherstellen."
    >
      <h2>Passwort zurücksetzen</h2>
      {sent ? (
        <InlineAlert variant="success">
          Wenn ein Konto existiert, wurde ein Link zum Zurücksetzen versendet.
        </InlineAlert>
      ) : null}
      {failed ? (
        <InlineAlert variant="error">
          Der Link konnte nicht angefordert werden. Bitte versuche es erneut.
        </InlineAlert>
      ) : null}
      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField
          error={form.formState.errors.email?.message}
          htmlFor="forgot-email"
          label="E-Mail-Adresse"
        >
          <input
            autoComplete="email"
            className="auth-input"
            id="forgot-email"
            type="email"
            {...form.register('email')}
          />
        </FormField>
        <Button isLoading={form.formState.isSubmitting} type="submit">
          Link anfordern
        </Button>
      </form>
      <p className="auth-card__footer">
        <Link to="/login">Zurück zur Anmeldung</Link>
      </p>
    </AuthPageLayout>
  )
}
