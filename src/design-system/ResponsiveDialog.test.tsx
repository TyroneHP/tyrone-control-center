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

  it('shows a labelled close control only for dismissible dialogs', async () => {
    installMatchMedia()
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <p>Inhalt</p>
      </ResponsiveDialog>,
    )

    const closeButton = screen.getByRole('button', {
      name: 'Dialog schlie\u00dfen',
    })
    expect(closeButton).toBeVisible()
    await user.click(closeButton)
    expect(onClose).toHaveBeenCalledOnce()

    rerender(
      <ResponsiveDialog
        dismissible={false}
        onClose={onClose}
        open
        title="Kritischer Dialog"
      >
        <p>Inhalt</p>
      </ResponsiveDialog>,
    )
    expect(
      screen.queryByRole('button', { name: 'Dialog schlie\u00dfen' }),
    ).not.toBeInTheDocument()
  })

  it('locks background scrolling and restores prior styles on close and unmount', () => {
    installMatchMedia()
    const rootStyles = document.documentElement.style.cssText
    const bodyStyles = document.body.style.cssText
    document.documentElement.style.overflow = 'scroll'
    document.documentElement.style.overscrollBehavior = 'auto'
    document.body.style.overflow = 'clip'
    document.body.style.overscrollBehavior = 'none'

    try {
      const { rerender, unmount } = render(
        <ResponsiveDialog onClose={vi.fn()} open title="Dialogtitel">
          <p>Inhalt</p>
        </ResponsiveDialog>,
      )

      expect(document.documentElement.style.overflow).toBe('hidden')
      expect(document.documentElement.style.overscrollBehavior).toBe('contain')
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.body.style.overscrollBehavior).toBe('contain')

      rerender(
        <ResponsiveDialog onClose={vi.fn()} open={false} title="Dialogtitel">
          <p>Inhalt</p>
        </ResponsiveDialog>,
      )
      expect(document.documentElement.style.overflow).toBe('scroll')
      expect(document.documentElement.style.overscrollBehavior).toBe('auto')
      expect(document.body.style.overflow).toBe('clip')
      expect(document.body.style.overscrollBehavior).toBe('none')

      rerender(
        <ResponsiveDialog onClose={vi.fn()} open title="Dialogtitel">
          <p>Inhalt</p>
        </ResponsiveDialog>,
      )
      unmount()
      expect(document.documentElement.style.overflow).toBe('scroll')
      expect(document.documentElement.style.overscrollBehavior).toBe('auto')
      expect(document.body.style.overflow).toBe('clip')
      expect(document.body.style.overscrollBehavior).toBe('none')
    } finally {
      document.documentElement.style.cssText = rootStyles
      document.body.style.cssText = bodyStyles
    }
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
    expect(screen.getByRole('button', { name: /Dialog sch/ })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(initialFocusRef.current).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: /Dialog sch/ })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveFocus()
  })
})
