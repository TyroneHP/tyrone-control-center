import { useState } from 'react'
import { Menu } from 'lucide-react'
import { ResponsiveDialog } from '../../design-system'
import { useDevicePreferences } from '../../preferences/useDevicePreferences'
import { NavigationLink } from './NavigationLink'
import { navigationById, navigationItems } from './navigation'

export function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { mobileTabs } = useDevicePreferences()
  const fixedOverview = navigationById.get('overview')!
  const pinnedItems = mobileTabs.map((id) => navigationById.get(id)!)
  const mobileItems = [fixedOverview, ...pinnedItems]

  return (
    <nav aria-label="Mobile Navigation" className="mobile-navigation">
      <div className="mobile-navigation__bar">
        {mobileItems.map((item) => (
          <NavigationLink item={item} key={item.id} />
        ))}
        <button
          aria-expanded={moreOpen}
          className="mobile-navigation__more-button"
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={20} />
          <span>Mehr</span>
        </button>
      </div>

      <ResponsiveDialog
        dismissible
        onClose={() => setMoreOpen(false)}
        open={moreOpen}
        title="Alle Bereiche"
      >
        <nav aria-label="Alle Bereiche" className="mobile-navigation__sheet">
          {navigationItems.map((item) => (
            <NavigationLink
              item={item}
              key={item.id}
              onNavigate={() => setMoreOpen(false)}
            />
          ))}
        </nav>
      </ResponsiveDialog>
    </nav>
  )
}
