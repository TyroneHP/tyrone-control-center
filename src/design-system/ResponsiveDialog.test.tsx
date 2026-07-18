import { createRef, type RefObject, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponsiveDialog } from './ResponsiveDialog'

function installMatchMedia(initialMatches = false) {
  const mediaQueryList = {
    addEventListener: vi.fn(),
    matches: initialMatches,
    media: '',
    removeEventListener: vi.fn(),
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ ...mediaQueryList, media: query })),
  )
}

function OpenableDialog({
  initialFocusRef,
}: {
  initialFocusRef?: RefObject<HTMLButtonElement | null>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      <ResponsiveDialog
        actions={<button onClick={() => setOpen(false)}>Schließen</button>}
        initialFocusRef={initialFocusRef}
        onClose={() => setOpen(false)}
        open={open}
        title="Dialogtitel"
      >
        <button ref={initialFocusRef}>Erster Fokus</button>
        <button>Weiter</button>
      </ResponsiveDialog>
    </>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ResponsiveDialog', () => {
  it('renders labelled desktop dialog semantics and restores focus', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    render(<OpenableDialog />)

    const opener = screen.getByRole('button', { name: 'Öffnen' })
    await user.click(opener)

    expect(screen.getByRole('dialog', { name: 'Dialogtitel' })).toHaveAttribute(
      'aria-modal',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(opener).toHaveFocus()
  })

  it('uses sheet structure and a drag handle on mobile', () => {
    installMatchMedia(true)
    render(
      <ResponsiveDialog onClose={vi.fn()} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )

    expect(screen.getByRole('dialog')).toHaveClass('responsive-dialog--sheet')
    expect(screen.getByTestId('responsive-dialog-drag-handle')).toBeInTheDocument()
  })

  it('closes a non-critical dialog with Escape and backdrop', async () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )

    await user.keyboard('{Escape}')
    fireEvent.click(screen.getByTestId('responsive-dialog-backdrop'))
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    fireEvent.pointerDown(handle, { clientY: 12 })
    fireEvent.pointerUp(handle, { clientY: 85 })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('does not dismiss a critical dialog with Escape, backdrop, or swipe', async () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <ResponsiveDialog dismissible={false} onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )

    await user.keyboard('{Escape}')
    fireEvent.click(screen.getByTestId('responsive-dialog-backdrop'))
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    fireEvent.pointerDown(handle, { clientY: 12 })
    fireEvent.pointerUp(handle, { clientY: 85 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps Tab focus inside and honors the initial focus ref', async () => {
    installMatchMedia()
    const initialFocusRef = createRef<HTMLButtonElement>()
    const user = userEvent.setup()
    render(<OpenableDialog initialFocusRef={initialFocusRef} />)

    await user.click(screen.getByRole('button', { name: 'Öffnen' }))

    expect(initialFocusRef.current).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(initialFocusRef.current).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveFocus()
  })
})
