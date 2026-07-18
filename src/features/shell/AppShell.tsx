import { useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import '../../design-system/tokens.css'
import './AppShell.css'
import { DesktopSidebar } from './DesktopSidebar'
import { NavigationLink } from './NavigationLink'
import { navigationItems } from './navigation'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = navigationItems.filter((item) => item.mobilePrimary)
  const moreItems = navigationItems.filter((item) => !item.mobilePrimary)

  return (
    <div className="app-shell">
      <DesktopSidebar />

      <main className="app-shell__content">{children}</main>

      <nav aria-label="Mobile Navigation" className="mobile-navigation">
        {moreOpen ? (
          <div className="mobile-navigation__more" aria-label="Weitere Bereiche">
            {moreItems.map((item) => (
              <NavigationLink item={item} key={item.path} />
            ))}
          </div>
        ) : null}
        <div className="mobile-navigation__bar">
          {primaryItems.map((item) => (
            <NavigationLink item={item} key={item.path} />
          ))}
          <button
            aria-expanded={moreOpen}
            className="mobile-navigation__more-button"
            onClick={() => setMoreOpen((open) => !open)}
            type="button"
          >
            {moreOpen ? (
              <X aria-hidden="true" size={20} />
            ) : (
              <Menu aria-hidden="true" size={20} />
            )}
            <span>Mehr</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
