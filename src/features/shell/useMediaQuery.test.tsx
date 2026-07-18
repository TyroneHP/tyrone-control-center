import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

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

function Probe() {
  const matches = useMediaQuery('(max-width: 767px)')
  return <output>{String(matches)}</output>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('updates when the registered media-query listener reports a changed match', () => {
    const media = installMatchMedia()
    render(<Probe />)

    expect(screen.getByRole('status')).toHaveTextContent('false')

    act(() => media.setMatches(true))

    expect(screen.getByRole('status')).toHaveTextContent('true')
  })
})
