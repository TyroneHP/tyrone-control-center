import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrainingBottomSheet } from './TrainingBottomSheet'

afterEach(() => {
  vi.unstubAllGlobals()
})

function SheetHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Planaktionen öffnen
      </button>
      <TrainingBottomSheet onClose={() => setOpen(false)} open={open} title="Planaktionen">
        <button type="button">Plan duplizieren</button>
      </TrainingBottomSheet>
    </>
  )
}

describe('TrainingBottomSheet', () => {
  it('returns focus to its opener after a dismissible sheet closes', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    }))
    const user = userEvent.setup()
    render(<SheetHarness />)

    await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Planaktionen öffnen' })).toHaveFocus()
  })
})
