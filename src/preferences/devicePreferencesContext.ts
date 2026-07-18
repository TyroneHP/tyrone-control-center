import { createContext } from 'react'
import type { PinnableNavigationId } from '../features/shell/navigation'
import type {
  DevicePreferences,
  ThemePreference,
} from './devicePreferences'

export interface DevicePreferencesContextValue extends DevicePreferences {
  moveMobileTab: (index: 0 | 1 | 2, direction: -1 | 1) => void
  setMobileTab: (index: 0 | 1 | 2, id: PinnableNavigationId) => void
  setTheme: (theme: ThemePreference) => void
  toggleDesktopSidebar: () => void
}

export const DevicePreferencesContext =
  createContext<DevicePreferencesContextValue | null>(null)
