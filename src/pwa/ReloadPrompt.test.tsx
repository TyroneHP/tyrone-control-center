import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ReloadPrompt } from './ReloadPrompt'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}))

const mockedUseRegisterSW = vi.mocked(useRegisterSW)

describe('ReloadPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('never reloads an update until the user explicitly confirms it', async () => {
    const setNeedRefresh = vi.fn()
    const updateServiceWorker = vi.fn()
    mockedUseRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    })

    render(<ReloadPrompt />)

    expect(screen.getByText('Eine neue Version ist verfügbar.')).toBeInTheDocument()
    expect(updateServiceWorker).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Später' }))
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('updates only after the explicit Aktualisieren action', async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined)
    mockedUseRegisterSW.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    })

    render(<ReloadPrompt />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Aktualisieren' }),
    )

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('shows the offline-ready notice once and lets the user close it', async () => {
    const setOfflineReady = vi.fn()
    mockedUseRegisterSW.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [true, setOfflineReady],
      updateServiceWorker: vi.fn(),
    })

    render(<ReloadPrompt />)

    expect(screen.getByText('Die App ist jetzt offline verfügbar.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(setOfflineReady).toHaveBeenCalledWith(false)
  })
})
