import { useContext } from 'react'
import {
  DevicePreferencesContext,
  type DevicePreferencesContextValue,
} from './DevicePreferencesProvider'

export function useDevicePreferences(): DevicePreferencesContextValue {
  const preferences = useContext(DevicePreferencesContext)
  if (preferences === null) {
    throw new Error('useDevicePreferences must be used within DevicePreferencesProvider')
  }
  return preferences
}
