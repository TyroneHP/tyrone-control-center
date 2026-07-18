import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ResponsiveDialog, useToast } from '../../design-system'
import {
  AccountFunctionError,
  getSettingsApi,
  type Invitation,
  type ManageUserRequest,
  type Profile,
  type SettingsApi,
} from './settingsApi'

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

function isVisibleFocusTarget(element: HTMLButtonElement) {
  if (
    !element.isConnected ||
    element.disabled ||
    element.closest('[hidden], [aria-hidden="true"], [inert]')
  ) {
    return false
  }

  const view = element.ownerDocument.defaultView
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const styles = view?.getComputedStyle(current)
    if (
      styles?.display === 'none' ||
      styles?.visibility === 'hidden' ||
      styles?.visibility === 'collapse' ||
      styles?.opacity === '0' ||
      styles?.contentVisibility === 'hidden'
    ) {
      return false
    }
  }

  return true
}

export function AdminAccountManagement({
  api = getSettingsApi(),
  profile,
}: {
  api?: SettingsApi
  profile: Profile
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [confirmation, setConfirmation] = useState<Profile | null>(null)
  const accountManagementTitleRef = useRef<HTMLHeadingElement>(null)
  const deactivationOpenerRef = useRef<HTMLButtonElement>(null)
  const pendingDeactivationFocusRef = useRef<HTMLButtonElement | null>(null)
  const isAdmin = profile.role === 'admin' && profile.status === 'active'
  const accountsQuery = useQuery({
    enabled: isAdmin,
    queryFn: api.listAccounts,
    queryKey: ['settings', 'accounts'],
  })
  const refreshAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ['settings', 'accounts'] })
  const inviteMutation = useMutation({
    mutationFn: (invitationEmail: string) => api.inviteUser(invitationEmail),
    onSuccess: async () => {
      setEmail('')
      toast.show({ message: 'Einladung wurde gesendet.', variant: 'success' })
      await refreshAccounts()
    },
  })
  const manageMutation = useMutation({
    mutationFn: (request: ManageUserRequest) => api.manageUser(request),
    onSuccess: async (_data, request) => {
      if (request.action === 'deactivate') {
        pendingDeactivationFocusRef.current = deactivationOpenerRef.current
      }
      setConfirmation(null)
      toast.show({
        message:
          request.action === 'restore'
            ? 'Konto wurde wiederhergestellt.'
            : 'Konto wurde deaktiviert.',
        variant: 'success',
      })
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

  useLayoutEffect(() => {
    if (manageMutation.isPending) return

    const opener = pendingDeactivationFocusRef.current
    if (!opener) return
    pendingDeactivationFocusRef.current = null

    const fallback = accountManagementTitleRef.current
    if (!fallback || fallback.ownerDocument.activeElement !== fallback) return
    if (!isVisibleFocusTarget(opener)) return

    opener.focus()
    if (opener.ownerDocument.activeElement !== opener) fallback.focus()
  }, [manageMutation.isPending])

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || capacityControlsDisabled) return
    inviteMutation.mutate(email.trim())
  }

  return (
    <section className="settings-admin" aria-labelledby="account-management-title">
      <header className="settings-admin__header">
        <div>
          <p className="settings-page__eyebrow">Administration</p>
          <h2 id="account-management-title" ref={accountManagementTitleRef} tabIndex={-1}>
            Kontoverwaltung
          </h2>
          <p>Einladungen, Zugänge und die serverseitige Kontogrenze verwalten.</p>
        </div>
        <div className="settings-capacity" aria-live="polite">
          <strong>{capacityKnown ? `${occupiedSlots} von ${maximumSlots}` : '–'}</strong>
          <span>
            {capacityKnown
              ? 'Kontoplätzen belegt oder reserviert'
              : accountsQuery.isError
                ? 'Kontostand nicht verfügbar.'
                : 'Kontostand wird geladen.'}
          </span>
        </div>
      </header>

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
        <button disabled={capacityControlsDisabled || inviteMutation.isPending} type="submit">
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

      {accountsQuery.isPending ? <div className="settings-card">Konten werden geladen …</div> : null}
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
                      <span>Löschung geplant: {formatDate(item.deletion_scheduled_at)}</span>
                    ) : null}
                  </div>
                  <div className="account-row__actions">
                    {isCurrent ? <span>Aktuelles Konto</span> : null}
                    {!isCurrent && item.status !== 'deactivated' ? (
                      <button
                        aria-label={`Konto von ${item.email} deaktivieren`}
                        className="button-secondary button-danger"
                        disabled={manageMutation.isPending}
                        onClick={(event) => {
                          deactivationOpenerRef.current = event.currentTarget
                          manageMutation.reset()
                          setConfirmation(item)
                        }}
                        type="button"
                      >
                        Deaktivieren
                      </button>
                    ) : null}
                    {item.status === 'deactivated' && invitation?.status === 'accepted' ? (
                      <button
                        className="button-secondary"
                        disabled={capacityControlsDisabled || manageMutation.isPending}
                        onClick={() =>
                          manageMutation.mutate({ action: 'restore', userId: item.id })
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

      {manageMutation.isError &&
      (manageMutation.variables?.action !== 'deactivate' || !confirmation) ? (
        <p className="settings-message settings-message--error" role="alert">
          {accountErrorMessage(
            manageMutation.error,
            'Die Kontoänderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
          )}
        </p>
      ) : null}

      {confirmation ? (
        <ResponsiveDialog
          actions={
            <>
              <button
                className="button-secondary"
                disabled={manageMutation.isPending}
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
            </>
          }
          dismissible={false}
          onClose={() => setConfirmation(null)}
          open
          restoreFocusFallbackRef={accountManagementTitleRef}
          title="Konto deaktivieren"
        >
          <p>
            Der Zugriff für <strong>{confirmation.email}</strong> endet sofort. Der
            Kontoplatz wird freigegeben; private Daten werden nach 30 Tagen endgültig
            gelöscht, sofern das Konto nicht vorher wiederhergestellt wird.
          </p>
          {manageMutation.isError &&
          manageMutation.variables?.action === 'deactivate' ? (
            <p className="settings-message settings-message--error" role="alert">
              {accountErrorMessage(
                manageMutation.error,
                'Die Kontoänderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
              )}
            </p>
          ) : null}
        </ResponsiveDialog>
      ) : null}
    </section>
  )
}
