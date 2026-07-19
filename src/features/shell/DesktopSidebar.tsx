import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useDevicePreferences } from '../../preferences/useDevicePreferences'
import { NavigationLink } from './NavigationLink'
import { navigationItems } from './navigation'
import { useMediaQuery } from './useMediaQuery'

export function DesktopSidebar() {
  const { desktopSidebar, toggleDesktopSidebar } = useDevicePreferences()
  const forcedCompact = useMediaQuery('(max-width: 1099px)')
  const manualCollapsed = desktopSidebar === 'collapsed'
  const collapsed = forcedCompact || manualCollapsed
  const toggleLabel = collapsed
    ? 'Seitenleiste ausklappen'
    : 'Seitenleiste einklappen'

  return (
    <aside
      className="app-shell__sidebar"
      data-collapsed={collapsed}
      data-forced-compact={forcedCompact}
    >
      <div className="app-shell__brand">
        <span className="app-shell__brand-mark">CG</span>
        <span className="app-shell__brand-name">CoreGrid</span>
      </div>
      <nav aria-label="Desktop-Navigation" className="app-navigation">
        {navigationItems.map((item) => (
          <NavigationLink collapsed={collapsed} item={item} key={item.path} />
        ))}
      </nav>
      {!forcedCompact ? (
        <button
          aria-label={toggleLabel}
          className="app-shell__sidebar-toggle"
          onClick={toggleDesktopSidebar}
          title={toggleLabel}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={20} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={20} />
          )}
        </button>
      ) : null}
    </aside>
  )
}
