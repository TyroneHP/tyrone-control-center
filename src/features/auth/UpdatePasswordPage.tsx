import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button, FormField, InlineAlert } from '../../design-system'
import { AuthPageLayout } from './AuthPageLayout'
import { getAuthApi, type AuthApi } from './authApi'
import {
  updatePasswordSchema,
  type UpdatePasswordValues,
} from './schemas'

export function UpdatePasswordPage({ api }: { api?: AuthApi }) {
  const [feedback, setFeedback] = useState<{
    message: string
    variant: 'error' | 'success'
  } | null>(null)
  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
  })

  async function submit({ password }: UpdatePasswordValues) {
    setFeedback(null)
    try {
      await (api ?? getAuthApi()).updatePassword(password)
      setFeedback({
        message: 'Das neue Passwort wurde gespeichert.',
        variant: 'success',
      })
    } catch {
      setFeedback({
        message: 'Das Passwort konnte nicht gespeichert werden.',
        variant: 'error',
      })
    }
  }

  return (
    <AuthPageLayout
      description="Wähle ein starkes Passwort mit mindestens zwölf Zeichen."
      title="Neues Passwort."
    >
      <h2>Passwort festlegen</h2>
      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.message}</InlineAlert>
      ) : null}
      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField
          error={form.formState.errors.password?.message}
          htmlFor="new-password"
          label="Neues Passwort"
        >
          <input
            autoComplete="new-password"
            className="auth-input"
            id="new-password"
            type="password"
            {...form.register('password')}
          />
        </FormField>
        <FormField
          error={form.formState.errors.passwordConfirmation?.message}
          htmlFor="password-confirmation"
          label="Passwort wiederholen"
        >
          <input
            autoComplete="new-password"
            className="auth-input"
            id="password-confirmation"
            type="password"
            {...form.register('passwordConfirmation')}
          />
        </FormField>
        <Button isLoading={form.formState.isSubmitting} type="submit">
          Passwort speichern
        </Button>
      </form>
      <p className="auth-card__footer">
        <Link to="/login">Zur Anmeldung</Link>
      </p>
    </AuthPageLayout>
  )
}
