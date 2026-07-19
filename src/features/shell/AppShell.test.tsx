import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevicePreferencesProvider } from '../../preferences/DevicePreferencesProvider'
import type {
  DevicePreferenceStorage,
  DevicePreferences,
} from '../../preferences/devicePreferences'
import { AppShell } from './AppShell'
import { navigationItems } from './navigation'

const appShellCss = readFileSync('src/features/shell/AppShell.css', 'utf8')

function storage(
  desktopSidebar: 'expanded' | 'collapsed' = 'expanded',
  mobileTabs: DevicePreferences['mobileTabs'] = [
    'calendar',
    'tasks',
    'training',
  ],
): DevicePreferenceStorage {
  return {
    read: vi.fn(() => ({
      desktopSidebar,
      mobileTabs,
      theme: 'dark' as const,
    })),
    write: vi.fn(() => true),
  }
}

function installMatchMedia(initialMatches = false) {
  let matches = initialMatches
  const listeners = new Set<() => void>()
  const mediaQueryList = {
    addEventListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'change') listeners.add(listener)
    }),
    matches,
    media: '',
    removeEventListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'change') listeners.delete(listener)
    }),
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      mediaQueryList.media = query
      mediaQueryList.matches = matches
      return mediaQueryList
    }),
  )

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      mediaQueryList.matches = nextMatches
      listeners.forEach((listener) => listener())
    },
  }
}

function renderShell(deviceStorage = storage()) {
  return render(
    <MemoryRouter>
      <DevicePreferencesProvider storage={deviceStorage}>
        <AppShell>
          <h1>Übersicht</h1>
        </AppShell>
      </DevicePreferencesProvider>
    </MemoryRouter>,
  )
}

function directMobileBarControls() {
  const mobileNavigation = screen.getByRole('navigation', {
    name: 'Mobile Navigation',
  })
  const bar = mobileNavigation.querySelector('.mobile-navigation__bar')

  expect(bar).not.toBeNull()
  return Array.from(bar!.children)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell', () => {
  it('toggles the desktop sidebar and persists the manual choice', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    const deviceStorage = storage()
    renderShell(deviceStorage)

    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    await user.click(
      screen.getByRole('button', { name: 'Seitenleiste einklappen' }),
    )

    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(deviceStorage.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ desktopSidebar: 'collapsed' }),
    )
    expect(
      screen.getByRole('button', { name: 'Seitenleiste ausklappen' }),
    ).toBeInTheDocument()
  })

  it('restores a stored collapsed sidebar', () => {
    installMatchMedia()
    renderShell(storage('collapsed'))

    expect(screen.getByRole('complementary')).toHaveAttribute(
      'data-collapsed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Seitenleiste ausklappen' }),
    ).toBeInTheDocument()
  })

  it('keeps accessible names and German tooltips while collapsed', () => {
    installMatchMedia()
    renderShell(storage('collapsed'))

    const desktop = screen.getByRole('navigation', {
      name: 'Desktop-Navigation',
    })
    for (const item of navigationItems) {
      const link = within(desktop).getByRole('link', { name: item.label })
      expect(link).toHaveAttribute('href', item.path)
      expect(link).toHaveAttribute('title', item.label)
    }
  })

  it('forces compact mode below 1100px without overwriting manual state', () => {
    const media = installMatchMedia()
    const deviceStorage = storage()
    renderShell(deviceStorage)

    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    act(() => media.setMatches(true))

    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(sidebar).toHaveAttribute('data-forced-compact', 'true')
    expect(
      screen.queryByRole('button', { name: 'Seitenleiste einklappen' }),
    ).not.toBeInTheDocument()
    expect(deviceStorage.write).not.toHaveBeenCalled()

    act(() => media.setMatches(false))

    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(sidebar).toHaveAttribute('data-forced-compact', 'false')
    expect(
      screen.getByRole('button', { name: 'Seitenleiste einklappen' }),
    ).toBeInTheDocument()
  })

  it('keeps mobile content flush when the hidden sidebar is forced compact', () => {
    const mobileRules = appShellCss.slice(
      appShellCss.indexOf('@media (max-width: 767px)'),
    )

    expect(mobileRules).toMatch(
      /\.app-shell:has\(\.app-shell__sidebar\[data-collapsed='true'\]\) \.app-shell__content\s*\{\s*margin-left: 0;/,
    )
  })

  it('adds safe-area insets to the fixed sidebar padding', () => {
    expect(appShellCss).toMatch(
      /padding:\s*calc\(1\.35rem \+ env\(safe-area-inset-top\)\)\s+calc\(1rem \+ env\(safe-area-inset-right\)\)\s+calc\(1\.35rem \+ env\(safe-area-inset-bottom\)\)\s+calc\(1rem \+ env\(safe-area-inset-left\)\);/,
    )
  })

  it('keeps the desktop sidebar vertically scrollable without inline overflow', () => {
    const desktopRules = appShellCss.slice(
      0,
      appShellCss.indexOf('@media (max-width: 767px)'),
    )

    expect(desktopRules).toMatch(
      /\.app-shell__sidebar\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-inline-size:\s*100%;[\s\S]*?min-block-size:\s*0;[\s\S]*?overflow-y:\s*auto;/,
    )
    expect(desktopRules).toMatch(
      /\.app-navigation__link\s*\{[\s\S]*?min-inline-size:\s*0;/,
    )
    expect(desktopRules).toMatch(
      /\.app-navigation__link > span\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
    )
  })

  it('adds horizontal safe-area insets to the mobile navigation bar', () => {
    const mobileRules = appShellCss.slice(
      appShellCss.indexOf('@media (max-width: 767px)'),
    )

    expect(mobileRules).toMatch(
      /\.mobile-navigation\s*\{[^}]*padding:\s*0\s+calc\(0\.5rem \+ env\(safe-area-inset-right\)\)\s+max\(0\.5rem, env\(safe-area-inset-bottom\)\)\s+calc\(0\.5rem \+ env\(safe-area-inset-left\)\);/,
    )
  })

  it('renders Overview, three defaults, and More in exactly that order', () => {
    installMatchMedia()
    renderShell()

    const controls = directMobileBarControls()
    const labels = [
      '\u00dcbersicht',
      'Kalender',
      'Aufgaben',
      'Training',
      'Mehr',
    ]

    expect(controls).toHaveLength(5)
    expect(controls.map((control) => control.textContent)).toEqual(labels)
    controls.forEach((control, index) => {
      expect(control).toHaveAccessibleName(labels[index])
    })
  })

  it('renders icons and labels for all five positions', () => {
    installMatchMedia()
    renderShell()

    const controls = directMobileBarControls()

    for (const control of controls) {
      expect(control).toHaveAccessibleName()
      expect(control.querySelector('svg')).not.toBeNull()
    }
  })

  it('uses persisted configured tabs without duplicates', () => {
    installMatchMedia()
    renderShell(
      storage(
        'expanded',
        ['files', 'files', 'settings'] as unknown as DevicePreferences['mobileTabs'],
      ),
    )

    const controls = directMobileBarControls()
    const configuredLabels = controls.slice(1, 4).map((control) => control.textContent)

    expect(controls).toHaveLength(5)
    expect(configuredLabels).toEqual(['Dateien', 'Einstellungen', 'Kalender'])
    expect(new Set(configuredLabels)).toHaveProperty('size', 3)
  })

  it('opens a sheet containing all ten destinations including pinned entries', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Mehr' }))

    const sheet = screen.getByRole('dialog', { name: 'Alle Bereiche' })
    const labels = within(sheet)
      .getAllByRole('link')
      .map((link) => link.textContent)

    expect(labels).toHaveLength(10)
    expect(labels).toEqual(
      expect.arrayContaining([
        '\u00dcbersicht',
        'Kalender',
        'Aufgaben',
        'Training',
        'Einstellungen',
      ]),
    )
  })

  it('closes the More sheet after destination navigation', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Mehr' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Alle Bereiche' })).getByRole(
        'link',
        { name: 'Technikerarbeit' },
      ),
    )

    expect(screen.queryByRole('dialog', { name: 'Alle Bereiche' })).not.toBeInTheDocument()
  })
})
