import type { AuthApi } from '../auth/authApi'
import { useAuth } from '../auth/authContextValue'
import type { SettingsApi } from './settingsApi'
import { AdminAccountManagement } from './AdminAccountManagement'
import { PersonalSettings } from './PersonalSettings'
import { SessionSettings } from './SessionSettings'
import './settings.css'

export interface SettingsPageProps {
  api?: SettingsApi
  authApi?: AuthApi
}

export function SettingsPage(props: SettingsPageProps) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' && profile.status === 'active'
  const isActiveMember =
    profile?.role === 'member' && profile.status === 'active'

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">Einstellungen</p>
          <h1>Persönliche Einstellungen</h1>
          <p>Darstellung, Navigation und Sitzungen auf diesem Gerät verwalten.</p>
        </div>
      </header>
      <PersonalSettings />
      <SessionSettings authApi={props.authApi} />
      {isActiveMember ? (
        <div className="settings-card settings-card--notice">
          Diese Kontoverwaltung ist nur für Administratoren verfügbar.
        </div>
      ) : null}
      {isAdmin ? (
        <AdminAccountManagement api={props.api} profile={profile} />
      ) : null}
    </section>
  )
}
