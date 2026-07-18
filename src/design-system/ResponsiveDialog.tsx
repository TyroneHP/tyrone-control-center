import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../features/shell/useMediaQuery'

export interface ResponsiveDialogProps {
  actions?: ReactNode
  children: ReactNode
  dismissible?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  title: string
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(', ')

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return []

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0,
  )
}

export function ResponsiveDialog({
  actions,
  children,
  dismissible = true,
  initialFocusRef,
  onClose,
  open,
  title,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const pointerStartYRef = useRef<number | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const initialFocus =
      initialFocusRef?.current ?? getFocusableElements(dialogRef.current)[0] ?? dialogRef.current
    initialFocus?.focus()

    return () => {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [initialFocusRef, open])

  if (!open || typeof document === 'undefined') return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(dialogRef.current)
    if (focusableElements.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && currentIndex === focusableElements.length - 1) {
      event.preventDefault()
      first.focus()
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStartYRef.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const pointerStartY = pointerStartYRef.current
    pointerStartYRef.current = null

    if (dismissible && isMobile && pointerStartY !== null && event.clientY - pointerStartY >= 72) {
      onClose()
    }
  }

  return createPortal(
    <div
      className="responsive-dialog__overlay"
      data-testid="responsive-dialog-backdrop"
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`responsive-dialog responsive-dialog--entering${
          isMobile ? ' responsive-dialog--sheet' : ''
        }`}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {isMobile ? (
          <div
            aria-hidden="true"
            className="responsive-dialog__drag-handle"
            data-testid="responsive-dialog-drag-handle"
            onPointerCancel={() => {
              pointerStartYRef.current = null
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          />
        ) : null}
        <header className="responsive-dialog__header">
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className="responsive-dialog__content">{children}</div>
        {actions ? <footer className="responsive-dialog__actions">{actions}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
