import { Outlet } from 'react-router-dom'
import { AppShell } from '../features/shell/AppShell'

export function ProtectedShell() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
