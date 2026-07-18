import {
  isPinnableNavigationId,
  navigationById,
  navigationItems,
  type NavigationItem,
  type PinnableNavigationId,
} from '../shell/navigation'
import { ThemeSwitch } from '../../preferences/ThemeSwitch'
import { useDevicePreferences } from '../../preferences/useDevicePreferences'

const pinnableNavigationItems = navigationItems.filter(
  (item): item is NavigationItem & { id: PinnableNavigationId } =>
    isPinnableNavigationId(item.id),
)

const mobileTabIndexes = [0, 1, 2] as const

export function PersonalSettings() {
  const {
    desktopSidebar,
    mobileTabs,
    moveMobileTab,
    setMobileTab,
    toggleDesktopSidebar,
  } = useDevicePreferences()
  const sidebarExpanded = desktopSidebar === 'expanded'

  return (
    <>
      <div className="settings-card">
        <div className="settings-card__heading">
          <div>
            <h2>Darstellung</h2>
            <p>Wähle die Darstellung und Seitenleiste für dieses Gerät.</p>
          </div>
        </div>
        <ThemeSwitch />
        <div className="settings-preference-row">
          <span>
            <strong>Desktop-Seitenleiste</strong>
            <small>{sidebarExpanded ? 'Ausgeklappt' : 'Eingeklappt'}</small>
          </span>
          <button
            className="button-secondary"
            onClick={toggleDesktopSidebar}
            type="button"
          >
            {sidebarExpanded ? 'Seitenleiste einklappen' : 'Seitenleiste ausklappen'}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__heading">
          <div>
            <h2>Mobile Navigation</h2>
            <p>Lege drei Ziele fest und ordne sie für dieses Gerät an.</p>
          </div>
        </div>

        <div className="mobile-tabs-preview" aria-label="Vorschau der mobilen Navigation">
          <span className="mobile-tabs-preview__fixed">Übersicht</span>
          {mobileTabs.map((id) => (
            <span key={id}>{navigationItems.find((item) => item.id === id)?.label}</span>
          ))}
          <span className="mobile-tabs-preview__fixed">Mehr</span>
        </div>

        <div className="mobile-tab-settings">
          {mobileTabIndexes.map((index) => {
            const currentItem = navigationById.get(mobileTabs[index])!
            const CurrentIcon = currentItem.icon

            return (
              <div className="mobile-tab-setting" key={index}>
              <span className="mobile-tab-setting__current">
                <CurrentIcon aria-hidden="true" size={20} strokeWidth={1.8} />
                <span>{currentItem.label}</span>
              </span>
              <label>
                <span>Tab {index + 1}</span>
                <select
                  aria-label={`Tab ${index + 1}`}
                  onChange={(event) =>
                    setMobileTab(index, event.target.value as PinnableNavigationId)
                  }
                  value={mobileTabs[index]}
                >
                  {pinnableNavigationItems.map((item) => (
                    <option
                      disabled={
                        item.id !== mobileTabs[index] && mobileTabs.includes(item.id)
                      }
                      key={item.id}
                      value={item.id}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mobile-tab-setting__actions">
                <button
                  aria-label={`Tab ${index + 1} nach links`}
                  className="button-secondary"
                  disabled={index === 0}
                  onClick={() => moveMobileTab(index, -1)}
                  type="button"
                >
                  Nach links
                </button>
                <button
                  aria-label={`Tab ${index + 1} nach rechts`}
                  className="button-secondary"
                  disabled={index === 2}
                  onClick={() => moveMobileTab(index, 1)}
                  type="button"
                >
                  Nach rechts
                </button>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
