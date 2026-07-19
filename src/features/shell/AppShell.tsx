import type { ReactNode } from 'react'
import '../../design-system/tokens.css'
import './AppShell.css'
import { DesktopSidebar } from './DesktopSidebar'
import { MobileNavigation } from './MobileNavigation'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <DesktopSidebar />

      <main className="app-shell__content">{children}</main>

      <MobileNavigation />
    </div>
  )
}
