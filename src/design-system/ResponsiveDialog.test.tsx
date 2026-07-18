import { createRef, type RefObject, useRef, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponsiveDialog } from './ResponsiveDialog'
import { ToastProvider, useToast } from './ToastProvider'

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

function installPointerCapture(handle: HTMLElement) {
  const capturedPointers = new Set<number>()
  const setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.add(pointerId)
  })
  const hasPointerCapture = vi.fn((pointerId: number) =>
    capturedPointers.has(pointerId),
  )
  const releasePointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.delete(pointerId)
  })

  Object.defineProperties(handle, {
    hasPointerCapture: { configurable: true, value: hasPointerCapture },
    releasePointerCapture: { configurable: true, value: releasePointerCapture },
    setPointerCapture: { configurable: true, value: setPointerCapture },
  })

  return { hasPointerCapture, releasePointerCapture, setPointerCapture }
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

function DisabledOpenerDialog() {
  const [disabled, setDisabled] = useState(false)
  const [open, setOpen] = useState(false)
  const fallbackFocusRef = useRef<HTMLHeadingElement>(null)

  return (
    <>
      <h2 ref={fallbackFocusRef} tabIndex={-1}>
        Stabiles Fokusziel
      </h2>
      <button disabled={disabled} onClick={() => setOpen(true)} type="button">
        Dialog mit Fallback öffnen
      </button>
      <ResponsiveDialog
        actions={
          <button
            onClick={() => {
              setDisabled(true)
              setOpen(false)
            }}
            type="button"
          >
            Erfolgreich schließen
          </button>
        }
        onClose={() => setOpen(false)}
        open={open}
        restoreFocusFallbackRef={fallbackFocusRef}
        title="Dialogtitel"
      >
        <p>Inhalt</p>
      </ResponsiveDialog>
    </>
  )
}

function ModalToastHarness({ onToastAction }: { onToastAction: () => void }) {
  const [open, setOpen] = useState(false)
  const toast = useToast()

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Kritischen Dialog öffnen
      </button>
      <button
        onClick={() =>
          toast.show({
            action: { label: 'Erneut versuchen', onAction: onToastAction },
            duration: 0,
            message: 'Speichern fehlgeschlagen',
            variant: 'warning',
          })
        }
        type="button"
      >
        Toast anzeigen
      </button>
      <ResponsiveDialog
        actions={
          <>
            <button onClick={() => setOpen(false)} type="button">
              Abbrechen
            </button>
            <button type="button">Bestätigen</button>
          </>
        }
        dismissible={false}
        onClose={() => setOpen(false)}
        open={open}
        title="Kritischer Dialog"
      >
        <button type="button">Erster Dialogfokus</button>
      </ResponsiveDialog>
    </>
  )
}

function StackedDialogHarness() {
  const [firstOpen, setFirstOpen] = useState(false)
  const [secondOpen, setSecondOpen] = useState(false)

  return (
    <>
      <button onClick={() => setFirstOpen(true)} type="button">
        Ersten Dialog öffnen
      </button>
      <ResponsiveDialog
        actions={
          <button onClick={() => setFirstOpen(false)} type="button">
            Ersten schließen
          </button>
        }
        dismissible={false}
        onClose={() => setFirstOpen(false)}
        open={firstOpen}
        title="Erster Dialog"
      >
        <button onClick={() => setSecondOpen(true)} type="button">
          Zweiten Dialog öffnen
        </button>
      </ResponsiveDialog>
      <ResponsiveDialog
        actions={
          <>
            <button onClick={() => setFirstOpen(false)} type="button">
              Ersten im Hintergrund schließen
            </button>
            <button onClick={() => setSecondOpen(false)} type="button">
              Zweiten schließen
            </button>
          </>
        }
        dismissible={false}
        onClose={() => setSecondOpen(false)}
        open={secondOpen}
        title="Zweiter Dialog"
      >
        <button type="button">Zweiter Inhalt</button>
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

  it('restores focus to a stable fallback when the opener becomes disabled', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    render(<DisabledOpenerDialog />)

    const opener = screen.getByRole('button', {
      name: 'Dialog mit Fallback öffnen',
    })
    await user.click(opener)
    await user.click(
      screen.getByRole('button', { name: 'Erfolgreich schließen' }),
    )

    expect(opener).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Stabiles Fokusziel' })).toHaveFocus()
    expect(document.body).not.toHaveFocus()
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

  it('keeps the desktop dialog free of bottom-sheet gesture controls', () => {
    installMatchMedia()
    render(
      <ResponsiveDialog onClose={vi.fn()} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )

    expect(screen.getByRole('dialog')).not.toHaveClass('responsive-dialog--sheet')
    expect(
      screen.queryByTestId('responsive-dialog-drag-handle'),
    ).not.toBeInTheDocument()
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

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes after a dominant downward drag beyond the threshold', () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )
    const dialog = screen.getByRole('dialog')
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    const capture = installPointerCapture(handle)

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 12, clientY: 90, pointerId: 1 })
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('80px')
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 90, pointerId: 1 })

    expect(onClose).toHaveBeenCalledOnce()
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('')
    expect(capture.setPointerCapture).toHaveBeenCalledWith(1)
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('resets a short downward drag without closing', () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )
    const dialog = screen.getByRole('dialog')
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    const capture = installPointerCapture(handle)

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 2 })
    fireEvent.pointerMove(handle, { clientX: 12, clientY: 50, pointerId: 2 })
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('40px')
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 50, pointerId: 2 })

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('')
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(2)
  })

  it('fully resets pointer cancellation and accepts a new gesture', () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )
    const dialog = screen.getByRole('dialog')
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    const capture = installPointerCapture(handle)

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 7 })
    fireEvent.pointerMove(handle, { clientX: 12, clientY: 90, pointerId: 7 })
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('80px')
    fireEvent.pointerCancel(handle, { clientX: 12, clientY: 90, pointerId: 7 })

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('')
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7)

    fireEvent.pointerDown(handle, { clientX: 20, clientY: 20, pointerId: 8 })
    fireEvent.pointerMove(handle, { clientX: 22, clientY: 93, pointerId: 8 })
    fireEvent.pointerUp(handle, { clientX: 22, clientY: 93, pointerId: 8 })

    expect(onClose).toHaveBeenCalledOnce()
    expect(capture.setPointerCapture).toHaveBeenLastCalledWith(8)
    expect(capture.releasePointerCapture).toHaveBeenLastCalledWith(8)
  })

  it('does not close after a horizontal-dominant gesture', () => {
    installMatchMedia(true)
    const onClose = vi.fn()
    render(
      <ResponsiveDialog dismissible onClose={onClose} open title="Dialogtitel">
        <button>Weiter</button>
      </ResponsiveDialog>,
    )
    const dialog = screen.getByRole('dialog')
    const handle = screen.getByTestId('responsive-dialog-drag-handle')
    const capture = installPointerCapture(handle)

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 9 })
    fireEvent.pointerMove(handle, { clientX: 130, clientY: 90, pointerId: 9 })
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('')
    fireEvent.pointerUp(handle, { clientX: 130, clientY: 90, pointerId: 9 })

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.getPropertyValue('--responsive-dialog-drag-y')).toBe('')
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(9)
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
    const capture = installPointerCapture(handle)
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 12, pointerId: 10 })
    fireEvent.pointerMove(handle, { clientX: 12, clientY: 85, pointerId: 10 })
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 85, pointerId: 10 })

    expect(onClose).not.toHaveBeenCalled()
    expect(capture.setPointerCapture).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').style.getPropertyValue('--responsive-dialog-drag-y')).toBe(
      '',
    )
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

  it('keeps focus and interaction inside a modal while a toast remains accessible', async () => {
    installMatchMedia()
    const onToastAction = vi.fn()
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ModalToastHarness onToastAction={onToastAction} />
      </ToastProvider>,
    )

    const opener = screen.getByRole('button', {
      name: 'Kritischen Dialog öffnen',
    })
    await user.click(screen.getByRole('button', { name: 'Toast anzeigen' }))
    await user.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Kritischer Dialog' })
    const toast = screen.getByRole('status', {
      name: 'Warnung: Speichern fehlgeschlagen',
    })
    const toastAction = screen.getByRole('button', {
      name: 'Erneut versuchen',
    })
    expect(dialog).not.toContainElement(toastAction)
    expect(toast).toBeVisible()
    expect(toast).toHaveAccessibleName('Warnung: Speichern fehlgeschlagen')

    toastAction.focus()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    const pointerHandler = vi.fn()
    toastAction.addEventListener('pointerdown', pointerHandler)
    expect(fireEvent.pointerDown(toastAction)).toBe(false)
    expect(pointerHandler).not.toHaveBeenCalled()
    fireEvent.click(toastAction)
    expect(onToastAction).not.toHaveBeenCalled()
    expect(toast).toBeInTheDocument()

    const first = within(dialog).getByRole('button', {
      name: 'Erster Dialogfokus',
    })
    const last = within(dialog).getByRole('button', { name: 'Bestätigen' })
    last.focus()
    await user.keyboard('{Tab}')
    expect(first).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(last).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(opener).toHaveFocus()
    toastAction.focus()
    expect(toastAction).toHaveFocus()
    await user.click(toastAction)
    expect(onToastAction).toHaveBeenCalledOnce()
    expect(screen.queryByText('Speichern fehlgeschlagen')).not.toBeInTheDocument()
  })

  it('keeps the restoration chain when an underlying dialog closes first', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    const rootOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'scroll'

    try {
      render(<StackedDialogHarness />)

      const outside = screen.getByRole('button', {
        name: 'Ersten Dialog öffnen',
      })
      await user.click(outside)
      const firstDialog = screen.getByRole('dialog', { name: 'Erster Dialog' })
      await user.click(
        within(firstDialog).getByRole('button', {
          name: 'Zweiten Dialog öffnen',
        }),
      )
      const secondDialog = screen.getByRole('dialog', {
        name: 'Zweiter Dialog',
      })

      outside.focus()
      expect(secondDialog).toContainElement(document.activeElement as HTMLElement)
      await user.click(
        within(secondDialog).getByRole('button', {
          name: 'Ersten im Hintergrund schließen',
        }),
      )

      expect(
        screen.queryByRole('dialog', { name: 'Erster Dialog' }),
      ).not.toBeInTheDocument()
      expect(document.documentElement.style.overflow).toBe('hidden')
      outside.focus()
      expect(secondDialog).toContainElement(document.activeElement as HTMLElement)
      await user.click(
        within(secondDialog).getByRole('button', { name: 'Zweiten schließen' }),
      )

      expect(outside).toHaveFocus()
      expect(document.documentElement.style.overflow).toBe('scroll')
    } finally {
      document.documentElement.style.overflow = rootOverflow
    }
  })

  it('restores focus into an underlying dialog when the top dialog closes first', async () => {
    installMatchMedia()
    const user = userEvent.setup()
    const rootStyles = document.documentElement.style.cssText
    const bodyStyles = document.body.style.cssText
    document.documentElement.style.overflow = 'scroll'

    const { unmount } = render(<StackedDialogHarness />)

    try {
      const outside = screen.getByRole('button', {
        name: 'Ersten Dialog öffnen',
      })
      await user.click(outside)
      const firstDialog = screen.getByRole('dialog', { name: 'Erster Dialog' })
      const secondOpener = within(firstDialog).getByRole('button', {
        name: 'Zweiten Dialog öffnen',
      })
      await user.click(secondOpener)
      const secondDialog = screen.getByRole('dialog', {
        name: 'Zweiter Dialog',
      })

      await user.click(
        within(secondDialog).getByRole('button', {
          name: 'Zweiten schließen',
        }),
      )

      expect(
        screen.queryByRole('dialog', { name: 'Zweiter Dialog' }),
      ).not.toBeInTheDocument()
      expect(firstDialog).toBeInTheDocument()
      expect(secondOpener).toHaveFocus()
      expect(document.documentElement.style.overflow).toBe('hidden')

      await user.click(
        within(firstDialog).getByRole('button', { name: 'Ersten schließen' }),
      )

      expect(outside).toHaveFocus()
      expect(document.documentElement.style.overflow).toBe('scroll')
    } finally {
      unmount()
      document.documentElement.style.cssText = rootStyles
      document.body.style.cssText = bodyStyles
    }
  })
})
