import {
  createDevicePreferenceStorage,
  DEFAULT_DEVICE_PREFERENCES,
  DEVICE_PREFERENCES_KEY,
  sanitizeDevicePreferences,
} from './devicePreferences'

describe('device preferences', () => {
  it('uses Dark mode and the confirmed navigation defaults', () => {
    expect(sanitizeDevicePreferences(undefined)).toEqual(
      DEFAULT_DEVICE_PREFERENCES,
    )
    expect(DEFAULT_DEVICE_PREFERENCES).toEqual({
      desktopSidebar: 'expanded',
      mobileTabs: ['calendar', 'tasks', 'training'],
      theme: 'dark',
    })
  })

  it('repairs invalid and duplicate mobile destinations in stable order', () => {
    expect(
      sanitizeDevicePreferences({
        desktopSidebar: 'wide',
        mobileTabs: ['files', 'files', 'overview', 'obsolete'],
        theme: 'system',
      }),
    ).toEqual({
      desktopSidebar: 'expanded',
      mobileTabs: ['files', 'calendar', 'tasks'],
      theme: 'dark',
    })
  })

  it('reads sanitized values and reports storage write failures', () => {
    const values = new Map<string, string>()
    values.set(
      DEVICE_PREFERENCES_KEY,
      JSON.stringify({
        desktopSidebar: 'collapsed',
        mobileTabs: ['settings', 'nutrition', 'ai'],
        theme: 'light',
      }),
    )
    const storage = createDevicePreferenceStorage({
      getItem: (key) => values.get(key) ?? null,
      setItem: () => {
        throw new DOMException('blocked')
      },
    })

    expect(storage.read()).toEqual({
      desktopSidebar: 'collapsed',
      mobileTabs: ['settings', 'nutrition', 'ai'],
      theme: 'light',
    })
    expect(storage.write(DEFAULT_DEVICE_PREFERENCES)).toBe(false)
  })
})
