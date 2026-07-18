import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevicePreferencesProvider } from '../../preferences/DevicePreferencesProvider'
import type { DevicePreferenceStorage } from '../../preferences/devicePreferences'
import { AppShell } from './AppShell'
import { navigationItems } from './navigation'

const appShellCss = readFileSync('src/features/shell/AppShell.css', 'utf8')

function storage(
  desktopSidebar: 'expanded' | 'collapsed' = 'expanded',
): DevicePreferenceStorage {
  return {
    read: vi.fn(() => ({
      desktopSidebar,
      mobileTabs: ['calendar', 'tasks', 'training'] as const,
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
})
