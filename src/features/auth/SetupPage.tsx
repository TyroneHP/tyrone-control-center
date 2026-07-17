import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button, FormField, InlineAlert } from '../../design-system'
import { AuthPageLayout } from './AuthPageLayout'
import { getAuthApi, type AuthApi } from './authApi'
import { setupSchema, type SetupValues } from './schemas'

export function SetupPage({ api }: { api?: AuthApi }) {
  const [feedback, setFeedback] = useState<{
    message: string
    variant: 'error' | 'success'
  } | null>(null)
  const form = useForm<SetupValues>({ resolver: zodResolver(setupSchema) })

  async function submit({ email }: SetupValues) {
    setFeedback(null)
    try {
      await (api ?? getAuthApi()).bootstrapAdmin(email)
      setFeedback({
        message: 'Die Einladungs-E-Mail wurde versendet.',
        variant: 'success',
      })
    } catch {
      setFeedback({
        message: 'Die Ersteinrichtung konnte nicht gestartet werden.',
        variant: 'error',
      })
    }
  }

  return (
    <AuthPageLayout
      description="Nur die konfigurierte Administratoradresse kann das erste Konto anfordern. Danach ist die Ersteinrichtung dauerhaft geschlossen."
      title="Sicher starten."
    >
      <h2>Erstes Administratorkonto einrichten</h2>
      <p className="auth-card__copy">Eine öffentliche Registrierung ist nicht verfügbar.</p>
      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.message}</InlineAlert>
      ) : null}
      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField
          error={form.formState.errors.email?.message}
          htmlFor="setup-email"
          label="Administrator-E-Mail-Adresse"
        >
          <input
            autoComplete="email"
            className="auth-input"
            id="setup-email"
            type="email"
            {...form.register('email')}
          />
        </FormField>
        <Button isLoading={form.formState.isSubmitting} type="submit">
          Einladung anfordern
        </Button>
      </form>
      <p className="auth-card__footer">
        Bereits eingeladen? <Link to="/login">Zur Anmeldung</Link>
      </p>
    </AuthPageLayout>
  )
}
