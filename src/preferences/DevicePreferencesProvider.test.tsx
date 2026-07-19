import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { DevicePreferenceStorage } from './devicePreferences'
import { DevicePreferencesProvider } from './DevicePreferencesProvider'
import { ThemeSwitch } from './ThemeSwitch'
import { useDevicePreferences } from './useDevicePreferences'

function Probe() {
  const preferences = useDevicePreferences()
  return (
    <>
      <output>{JSON.stringify(preferences.mobileTabs)}</output>
      <button onClick={() => preferences.setMobileTab(1, 'calendar')}>
        Duplicate
      </button>
      <button onClick={() => preferences.moveMobileTab(0, -1)}>Move before</button>
      <button onClick={() => preferences.moveMobileTab(0, 1)}>Move after</button>
    </>
  )
}

function storage(theme: 'dark' | 'light' = 'dark'): DevicePreferenceStorage {
  return {
    read: vi.fn((): ReturnType<DevicePreferenceStorage['read']> => ({
      desktopSidebar: 'expanded',
      mobileTabs: ['calendar', 'tasks', 'training'],
      theme,
    })),
    write: vi.fn(() => true),
  }
}

describe('DevicePreferencesProvider', () => {
  it('renders the exact German device-storage copy', () => {
    render(
      <DevicePreferencesProvider storage={storage()}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )

    expect(
      screen.getByText('Auf diesem Ger\u00e4t gespeichert'),
    ).toBeInTheDocument()
  })

  it('starts Dark, switches to Light, persists, and updates the root', async () => {
    const deviceStorage = storage()
    render(
      <DevicePreferencesProvider storage={deviceStorage}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )

    const toggle = screen.getByRole('switch', { name: 'Dunkelmodus' })
    expect(toggle).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await userEvent.click(toggle)

    expect(toggle).not.toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(deviceStorage.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: 'light' }),
    )
  })

  it('restores a stored Light selection', () => {
    render(
      <DevicePreferencesProvider storage={storage('light')}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )
    expect(screen.getByRole('switch', { name: 'Dunkelmodus' })).not.toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('falls back to Dark when storage returns an invalid theme', () => {
    const deviceStorage = storage()
    vi.mocked(deviceStorage.read).mockReturnValue({
      desktopSidebar: 'expanded',
      mobileTabs: ['calendar', 'tasks', 'training'],
      theme: 'night',
    } as unknown as ReturnType<DevicePreferenceStorage['read']>)
    render(
      <DevicePreferencesProvider storage={deviceStorage}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )

    expect(screen.getByRole('switch', { name: 'Dunkelmodus' })).toBeChecked()
  })

  it('prevents duplicate tabs and keeps tab movement within its bounds', async () => {
    const user = userEvent.setup()
    const deviceStorage = storage()
    render(
      <DevicePreferencesProvider storage={deviceStorage}>
        <Probe />
      </DevicePreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    await user.click(screen.getByRole('button', { name: 'Move before' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '["calendar","tasks","training"]',
    )
    expect(deviceStorage.write).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Move after' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '["tasks","calendar","training"]',
    )
    expect(deviceStorage.write).toHaveBeenCalledOnce()
  })

  it('reports failed persistence without losing live state', async () => {
    const onPersistenceError = vi.fn()
    const deviceStorage = storage()
    vi.mocked(deviceStorage.write).mockReturnValue(false)
    render(
      <DevicePreferencesProvider
        onPersistenceError={onPersistenceError}
        storage={deviceStorage}
      >
        <ThemeSwitch />
        <Probe />
      </DevicePreferencesProvider>,
    )

    await userEvent.click(screen.getByRole('switch', { name: 'Dunkelmodus' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(onPersistenceError).toHaveBeenCalledOnce()
  })
})
