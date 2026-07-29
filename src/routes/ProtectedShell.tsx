import { Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth'
import { AppShell } from '../features/shell/AppShell'
import { TrainingProvider } from '../features/training/TrainingProvider'
import { TrainingRecoveryDialog } from '../features/training/components/TrainingRecoveryDialog'
import '../features/training/training.css'

export function ProtectedShell() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <TrainingProvider key={profile.id} profileId={profile.id}>
      <AppShell>
        <Outlet />
        <TrainingRecoveryDialog />
      </AppShell>
    </TrainingProvider>
  )
}
