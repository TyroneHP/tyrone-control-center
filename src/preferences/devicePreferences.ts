import {
  defaultMobileTabs,
  isPinnableNavigationId,
  navigationItems,
  type PinnableNavigationId,
} from '../features/shell/navigation'

export const DEVICE_PREFERENCES_KEY = 'tcc.device-preferences.v1'

export type ThemePreference = 'dark' | 'light'
export type DesktopSidebarPreference = 'expanded' | 'collapsed'

export interface DevicePreferences {
  desktopSidebar: DesktopSidebarPreference
  mobileTabs: readonly [
    PinnableNavigationId,
    PinnableNavigationId,
    PinnableNavigationId,
  ]
  theme: ThemePreference
}

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  desktopSidebar: 'expanded',
  mobileTabs: [...defaultMobileTabs],
  theme: 'dark',
}

export interface DevicePreferenceStorage {
  read: () => DevicePreferences
  write: (preferences: DevicePreferences) => boolean
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function sanitizeDevicePreferences(value: unknown): DevicePreferences {
  const record =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const requested = Array.isArray(record.mobileTabs) ? record.mobileTabs : []
  const mobileTabs: PinnableNavigationId[] = []

  for (const candidate of requested) {
    if (isPinnableNavigationId(candidate) && !mobileTabs.includes(candidate)) {
      mobileTabs.push(candidate)
    }
  }
  for (const item of [
    ...defaultMobileTabs,
    ...navigationItems.map((navigationItem) => navigationItem.id),
  ]) {
    if (
      mobileTabs.length < 3 &&
      isPinnableNavigationId(item) &&
      !mobileTabs.includes(item)
    ) {
      mobileTabs.push(item)
    }
  }

  return {
    desktopSidebar:
      record.desktopSidebar === 'collapsed' ? 'collapsed' : 'expanded',
    mobileTabs: mobileTabs.slice(0, 3) as unknown as DevicePreferences['mobileTabs'],
    theme: record.theme === 'light' ? 'light' : 'dark',
  }
}

export function createDevicePreferenceStorage(
  storage: StorageLike,
): DevicePreferenceStorage {
  return {
    read() {
      try {
        const raw = storage.getItem(DEVICE_PREFERENCES_KEY)
        return sanitizeDevicePreferences(raw ? JSON.parse(raw) : undefined)
      } catch {
        return DEFAULT_DEVICE_PREFERENCES
      }
    },
    write(preferences) {
      try {
        storage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences))
        return true
      } catch {
        return false
      }
    },
  }
}
