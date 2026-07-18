import { useState } from 'react'
import { ResponsiveDialog } from '../../design-system'
import { getAuthApi, type AuthApi } from '../auth/authApi'

export function SessionSettings({ authApi }: { authApi?: AuthApi }) {
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [sessionPending, setSessionPending] = useState<'all' | 'current' | null>(
    null,
  )
  const [sessionError, setSessionError] = useState(false)

  async function endSessions(scope: 'all' | 'current') {
    setSessionError(false)
    setSessionPending(scope)
    try {
      const sessionApi = authApi ?? getAuthApi()
      if (scope === 'all') {
        await sessionApi.signOutAll()
        setConfirmationOpen(false)
      } else {
        await sessionApi.signOutCurrent()
      }
    } catch {
      setSessionError(true)
    } finally {
      setSessionPending(null)
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-card__heading">
        <div>
          <h2>Sitzungen</h2>
          <p>Beende den Zugang auf diesem oder auf allen angemeldeten Geräten.</p>
        </div>
      </div>
      <div className="confirmation-dialog__actions">
        <button
          className="button-secondary"
          disabled={sessionPending !== null}
          onClick={() => void endSessions('current')}
          type="button"
        >
          {sessionPending === 'current'
            ? 'Abmeldung läuft …'
            : 'Auf diesem Gerät abmelden'}
        </button>
        <button
          className="button-secondary"
          disabled={sessionPending !== null}
          onClick={() => {
            setSessionError(false)
            setConfirmationOpen(true)
          }}
          type="button"
        >
          Auf allen Geräten abmelden
        </button>
      </div>
      {sessionError && !confirmationOpen ? (
        <p className="settings-message settings-message--error" role="alert">
          Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.
        </p>
      ) : null}

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button-secondary"
              disabled={sessionPending !== null}
              onClick={() => setConfirmationOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button-danger"
              disabled={sessionPending !== null}
              onClick={() => void endSessions('all')}
              type="button"
            >
              {sessionPending === 'all' ? 'Abmeldung läuft …' : 'Überall abmelden'}
            </button>
          </>
        }
        dismissible={false}
        onClose={() => setConfirmationOpen(false)}
        open={confirmationOpen}
        title="Auf allen Geräten abmelden"
      >
        <p>
          Alle aktiven Sitzungen werden beendet. Du musst dich auf jedem Gerät
          erneut anmelden.
        </p>
        {sessionError ? (
          <p className="settings-message settings-message--error" role="alert">
            Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.
          </p>
        ) : null}
      </ResponsiveDialog>
    </div>
  )
}
