import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/authContextValue'
import { getAuthApi, type AuthApi } from '../auth/authApi'
import {
  getSettingsApi,
  AccountFunctionError,
  type Invitation,
  type ManageUserRequest,
  type Profile,
  type SettingsApi,
} from './settingsApi'
import './settings.css'

const profileLabels: Record<Profile['status'], string> = {
  active: 'Aktiv',
  deactivated: 'Deaktiviert',
  invited: 'Eingeladen',
}

const invitationLabels: Record<Invitation['status'], string> = {
  accepted: 'Angenommen',
  expired: 'Abgelaufen',
  pending: 'Ausstehend',
  revoked: 'Widerrufen',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function pendingReservations(invitations: Invitation[]) {
  const now = Date.now()
  return invitations.filter(
    (invitation) =>
      invitation.status === 'pending' &&
      invitation.auth_user_id === null &&
      new Date(invitation.expires_at).getTime() > now,
  )
}

function accountErrorMessage(error: unknown, fallback: string) {
  return error instanceof AccountFunctionError ? error.message : fallback
}

export interface SettingsPageProps {
  api?: SettingsApi
  authApi?: AuthApi
}

export function SettingsPage({
  api = getSettingsApi(),
  authApi,
}: SettingsPageProps) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [confirmation, setConfirmation] = useState<Profile | null>(null)
  const [sessionPending, setSessionPending] = useState<'all' | 'current' | null>(
    null,
  )
  const [sessionError, setSessionError] = useState(false)
  const isAdmin = profile?.role === 'admin' && profile.status === 'active'
  const accountsQuery = useQuery({
    enabled: isAdmin,
    queryFn: api.listAccounts,
    queryKey: ['settings', 'accounts'],
  })
  const refreshAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ['settings', 'accounts'] })
  const inviteMutation = useMutation({
    mutationFn: api.inviteUser,
    onSuccess: async () => {
      setEmail('')
      await refreshAccounts()
    },
  })
  const manageMutation = useMutation({
    mutationFn: (request: ManageUserRequest) => api.manageUser(request),
    onSuccess: async () => {
      setConfirmation(null)
      await refreshAccounts()
    },
  })

  const data = accountsQuery.data
  const reservations = useMemo(
    () => pendingReservations(data?.invitations ?? []),
    [data?.invitations],
  )
  const occupiedSlots = data?.capacity.occupiedSlots ?? 0
  const maximumSlots = data?.capacity.maximumSlots ?? 0
  const capacityKnown = data !== undefined
  const capacityReached = capacityKnown && occupiedSlots >= maximumSlots
  const capacityControlsDisabled = !capacityKnown || capacityReached

  async function endSessions(scope: 'all' | 'current') {
    setSessionError(false)
    setSessionPending(scope)
    try {
      const sessionApi = authApi ?? getAuthApi()
      if (scope === 'all') {
        await sessionApi.signOutAll()
      } else {
        await sessionApi.signOutCurrent()
      }
    } catch {
      setSessionError(true)
    } finally {
      setSessionPending(null)
    }
  }

  const sessionControls = (
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
          onClick={() => void endSessions('all')}
          type="button"
        >
          {sessionPending === 'all'
            ? 'Abmeldung läuft …'
            : 'Auf allen Geräten abmelden'}
        </button>
      </div>
      {sessionError ? (
        <p className="settings-message settings-message--error" role="alert">
          Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.
        </p>
      ) : null}
    </div>
  )

  if (!isAdmin) {
    return (
      <section className="settings-page">
        <p className="settings-page__eyebrow">Einstellungen</p>
        <h1>Kontoverwaltung</h1>
        {sessionControls}
        <div className="settings-card settings-card--notice">
          Diese Kontoverwaltung ist nur für Administratoren verfügbar.
        </div>
      </section>
    )
  }

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || capacityControlsDisabled) return
    inviteMutation.mutate(email.trim())
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">Einstellungen</p>
          <h1>Kontoverwaltung</h1>
          <p>Einladungen, Zugänge und die serverseitige Kontogrenze verwalten.</p>
        </div>
        <div className="settings-capacity" aria-live="polite">
          <strong>
            {capacityKnown ? `${occupiedSlots} von ${maximumSlots}` : '–'}
          </strong>
          <span>
            {capacityKnown
              ? 'Kontoplätzen belegt oder reserviert'
              : accountsQuery.isError
                ? 'Kontostand nicht verfügbar.'
                : 'Kontostand wird geladen.'}
          </span>
        </div>
      </header>

      {sessionControls}

      <form className="settings-card settings-invite" onSubmit={submitInvitation}>
        <div>
          <h2>Mitglied einladen</h2>
          <p>
            {capacityKnown
              ? `Die Einladung reserviert sofort einen der ${maximumSlots} Kontoplätze.`
              : 'Die verfügbaren Kontoplätze werden zuerst geladen.'}
          </p>
        </div>
        <label>
          E-Mail-Adresse
          <input
            autoComplete="email"
            disabled={capacityControlsDisabled || inviteMutation.isPending}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@beispiel.de"
            required
            type="email"
            value={email}
          />
        </label>
        <button
          disabled={capacityControlsDisabled || inviteMutation.isPending}
          type="submit"
        >
          {inviteMutation.isPending ? 'Einladung wird gesendet …' : 'Einladung senden'}
        </button>
        {capacityReached ? (
          <p className="settings-message">
            Alle {maximumSlots} Kontoplätze sind belegt oder reserviert.
          </p>
        ) : null}
        {inviteMutation.isError ? (
          <p className="settings-message settings-message--error" role="alert">
            {accountErrorMessage(
              inviteMutation.error,
              'Die Einladung konnte nicht gesendet werden. Bitte versuche es erneut.',
            )}
          </p>
        ) : null}
      </form>

      {accountsQuery.isPending ? (
        <div className="settings-card">Konten werden geladen …</div>
      ) : null}
      {accountsQuery.isError ? (
        <div className="settings-card settings-message--error" role="alert">
          Die Konten konnten nicht geladen werden. Bitte lade die Seite erneut.
        </div>
      ) : null}

      {data ? (
        <div className="settings-card">
          <div className="settings-card__heading">
            <h2>Konten</h2>
            <span>{data.profiles.length}</span>
          </div>
          <div className="account-list">
            {data.profiles.map((item) => {
              const invitation = data.invitations.find(
                (candidate) => candidate.id === item.invitation_id,
              )
              const isCurrent = item.id === profile.id
              return (
                <article className="account-row" key={item.id}>
                  <div className="account-row__identity">
                    <strong>{item.display_name || item.email}</strong>
                    {item.display_name ? <span>{item.email}</span> : null}
                    <span>{item.role === 'admin' ? 'Administrator' : 'Mitglied'}</span>
                  </div>
                  <div className="account-row__state">
                    <span className={`status-badge status-badge--${item.status}`}>
                      {profileLabels[item.status]}
                    </span>
                    {invitation ? (
                      <span className="invitation-state">
                        Einladung
                        <span>{invitationLabels[invitation.status]}</span>
                      </span>
                    ) : null}
                    {item.deletion_scheduled_at ? (
                      <span>
                        Löschung geplant: {formatDate(item.deletion_scheduled_at)}
                      </span>
                    ) : null}
                  </div>
                  <div className="account-row__actions">
                    {isCurrent ? <span>Aktuelles Konto</span> : null}
                    {!isCurrent && item.status !== 'deactivated' ? (
                      <button
                        aria-label={`Konto von ${item.email} deaktivieren`}
                        className="button-secondary button-danger"
                        onClick={() => setConfirmation(item)}
                        type="button"
                      >
                        Deaktivieren
                      </button>
                    ) : null}
                    {item.status === 'deactivated' &&
                    invitation?.status === 'accepted' ? (
                      <button
                        className="button-secondary"
                        disabled={
                          capacityControlsDisabled || manageMutation.isPending
                        }
                        onClick={() =>
                          manageMutation.mutate({
                            action: 'restore',
                            userId: item.id,
                          })
                        }
                        type="button"
                      >
                        Wiederherstellen
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : null}

      {reservations.length > 0 ? (
        <div className="settings-card">
          <div className="settings-card__heading">
            <h2>Offene Reservierungen</h2>
            <span>{reservations.length}</span>
          </div>
          <div className="account-list">
            {reservations.map((invitation) => (
              <article className="account-row" key={invitation.id}>
                <div className="account-row__identity">
                  <strong>{invitation.email}</strong>
                  <span>Einladung bis {formatDate(invitation.expires_at)}</span>
                </div>
                <span className="status-badge status-badge--invited">
                  {invitationLabels[invitation.status]}
                </span>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {manageMutation.isError ? (
        <p className="settings-message settings-message--error" role="alert">
          {accountErrorMessage(
            manageMutation.error,
            'Die Kontoänderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
          )}
        </p>
      ) : null}

      {confirmation ? (
        <div
          aria-labelledby="deactivation-title"
          aria-modal="true"
          className="confirmation-backdrop"
          role="dialog"
        >
          <div className="confirmation-dialog">
            <p className="settings-page__eyebrow">Sicherheitsabfrage</p>
            <h2 id="deactivation-title">Konto deaktivieren</h2>
            <p>
              Der Zugriff für <strong>{confirmation.email}</strong> endet sofort.
              Der Kontoplatz wird freigegeben; private Daten werden nach 30 Tagen
              endgültig gelöscht, sofern das Konto nicht vorher wiederhergestellt
              wird.
            </p>
            <div className="confirmation-dialog__actions">
              <button
                className="button-secondary"
                onClick={() => setConfirmation(null)}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="button-danger"
                disabled={manageMutation.isPending}
                onClick={() =>
                  manageMutation.mutate({
                    action: 'deactivate',
                    userId: confirmation.id,
                  })
                }
                type="button"
              >
                Deaktivierung bestätigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
