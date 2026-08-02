import { useAuth } from '../features/auth'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TrainingProvider } from '../features/training/TrainingProvider'
import { TrainingRecoveryDialog } from '../features/training/components/TrainingRecoveryDialog'
import '../features/training/training.css'

export function SettingsRoute() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <TrainingProvider key={profile.id} profileId={profile.id}>
      <SettingsPage />
      <TrainingRecoveryDialog />
    </TrainingProvider>
  )
}
