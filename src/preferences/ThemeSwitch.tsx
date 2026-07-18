import { useDevicePreferences } from './useDevicePreferences'

export function ThemeSwitch() {
  const { setTheme, theme } = useDevicePreferences()
  return (
    <label className="theme-switch">
      <span>
        <strong>Dunkelmodus</strong>
        <small>{'Auf diesem Ger\u00e4t gespeichert'}</small>
      </span>
      <input
        aria-label="Dunkelmodus"
        checked={theme === 'dark'}
        onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="theme-switch__track" />
    </label>
  )
}
