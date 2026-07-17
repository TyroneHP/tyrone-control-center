import { useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import '../../design-system/tokens.css'
import './AppShell.css'
import { navigationItems, type NavigationItem } from './navigation'

export interface AppShellProps {
  children: ReactNode
}

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon

  return (
    <NavLink
      className={({ isActive }) =>
        `app-navigation__link${isActive ? ' app-navigation__link--active' : ''}`
      }
      end={item.path === '/'}
      to={item.path}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export function AppShell({ children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = navigationItems.filter((item) => item.mobilePrimary)
  const moreItems = navigationItems.filter((item) => !item.mobilePrimary)

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark">TC</span>
          <span>Tyrone Control Center</span>
        </div>
        <nav aria-label="Desktop-Navigation" className="app-navigation">
          {navigationItems.map((item) => (
            <NavigationLink item={item} key={item.path} />
          ))}
        </nav>
      </aside>

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
