import { Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth'
import { AppShell } from '../features/shell/AppShell'

export function ProtectedShell() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
