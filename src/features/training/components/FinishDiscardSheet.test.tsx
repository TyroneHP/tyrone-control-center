import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinishDiscardSheet } from './FinishDiscardSheet'

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media: query,
    removeEventListener: vi.fn(),
  }))
})

function SheetHarness({ action }: { action: 'discard' | 'finish' }) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const label = action === 'discard' ? 'Training verwerfen' : 'Training abschließen'

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">{label}</button>
      <output aria-label="Bestätigt">{String(confirmed)}</output>
      <FinishDiscardSheet
        action={action}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setConfirmed(true)
          setOpen(false)
        }}
        open={open}
      />
    </>
  )
}

describe('FinishDiscardSheet', () => {
  it('returns focus to the discard trigger when closed', async () => {
    const user = userEvent.setup()
    render(<SheetHarness action="discard" />)

    await user.click(screen.getByRole('button', { name: 'Training verwerfen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(screen.getByRole('button', { name: 'Training verwerfen' })).toHaveFocus()
  })

  it('confirms finishing from a focused dialog action', async () => {
    const user = userEvent.setup()
    render(<SheetHarness action="finish" />)

    await user.click(screen.getByRole('button', { name: 'Training abschließen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Training abschließen' }))

    expect(screen.getByLabelText('Bestätigt')).toHaveTextContent('true')
    expect(screen.getByRole('button', { name: 'Training abschließen' })).toHaveFocus()
  })
})
