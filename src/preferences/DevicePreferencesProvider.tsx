import {
  createContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PinnableNavigationId } from '../features/shell/navigation'
import {
  DEFAULT_DEVICE_PREFERENCES,
  sanitizeDevicePreferences,
  type DevicePreferenceStorage,
  type DevicePreferences,
  type ThemePreference,
} from './devicePreferences'

export interface DevicePreferencesContextValue extends DevicePreferences {
  moveMobileTab: (index: 0 | 1 | 2, direction: -1 | 1) => void
  setMobileTab: (index: 0 | 1 | 2, id: PinnableNavigationId) => void
  setTheme: (theme: ThemePreference) => void
  toggleDesktopSidebar: () => void
}

export const DevicePreferencesContext =
  createContext<DevicePreferencesContextValue | null>(null)

function readPreferences(storage: DevicePreferenceStorage): DevicePreferences {
  try {
    return sanitizeDevicePreferences(storage.read())
  } catch {
    return DEFAULT_DEVICE_PREFERENCES
  }
}

export function DevicePreferencesProvider({
  children,
  onPersistenceError,
  storage,
}: {
  children: ReactNode
  onPersistenceError?: () => void
  storage: DevicePreferenceStorage
}) {
  const [preferences, setPreferences] = useState(() => readPreferences(storage))
  const preferencesRef = useRef(preferences)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences.theme])

  const updatePreferences = useCallback(
    (next: DevicePreferences) => {
      preferencesRef.current = next
      setPreferences(next)
      if (!storage.write(next)) onPersistenceError?.()
    },
    [onPersistenceError, storage],
  )

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      const current = preferencesRef.current
      if (current.theme !== theme) updatePreferences({ ...current, theme })
    },
    [updatePreferences],
  )

  const toggleDesktopSidebar = useCallback(() => {
    const current = preferencesRef.current
    updatePreferences({
      ...current,
      desktopSidebar:
        current.desktopSidebar === 'expanded' ? 'collapsed' : 'expanded',
    })
  }, [updatePreferences])

  const setMobileTab = useCallback(
    (index: 0 | 1 | 2, id: PinnableNavigationId) => {
      const current = preferencesRef.current
      if (current.mobileTabs[index] === id || current.mobileTabs.includes(id)) return
      const mobileTabs = [...current.mobileTabs] as [
        PinnableNavigationId,
        PinnableNavigationId,
        PinnableNavigationId,
      ]
      mobileTabs[index] = id
      updatePreferences({ ...current, mobileTabs })
    },
    [updatePreferences],
  )

  const moveMobileTab = useCallback(
    (index: 0 | 1 | 2, direction: -1 | 1) => {
      const destination = index + direction
      if (destination < 0 || destination > 2) return

      const current = preferencesRef.current
      const mobileTabs = [...current.mobileTabs] as [
        PinnableNavigationId,
        PinnableNavigationId,
        PinnableNavigationId,
      ]
      const destinationIndex = destination as 0 | 1 | 2
      ;[mobileTabs[index], mobileTabs[destinationIndex]] = [
        mobileTabs[destinationIndex],
        mobileTabs[index],
      ]
      updatePreferences({ ...current, mobileTabs })
    },
    [updatePreferences],
  )

  return (
    <DevicePreferencesContext.Provider
      value={{
        ...preferences,
        moveMobileTab,
        setMobileTab,
        setTheme,
        toggleDesktopSidebar,
      }}
    >
      {children}
    </DevicePreferencesContext.Provider>
  )
}
