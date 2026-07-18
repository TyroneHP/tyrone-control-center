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
import { X } from 'lucide-react'
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

interface ModalEntry {
  dialog: HTMLElement
  interactionRoot: HTMLElement
  restoreFocusTargets: HTMLElement[]
}

interface ScrollStyles {
  bodyOverflow: string
  bodyOverscrollBehavior: string
  rootOverflow: string
  rootOverscrollBehavior: string
}

const modalStack: ModalEntry[] = []
let modalDocument: Document | null = null
let previousScrollStyles: ScrollStyles | null = null

function topModal() {
  return modalStack[modalStack.length - 1]
}

function focusTopModal() {
  const modal = topModal()
  if (!modal) return

  const activeElement = modal.dialog.ownerDocument.activeElement
  if (activeElement && modal.dialog.contains(activeElement)) return

  const target = getFocusableElements(modal.dialog)[0] ?? modal.dialog
  target.focus()
}

function restoreFocus(
  targets: HTMLElement[],
  within: HTMLElement | null = null,
) {
  for (const target of targets) {
    if (!target.isConnected || (within && !within.contains(target))) continue
    target.focus()
    if (target.ownerDocument.activeElement === target) return true
  }

  return false
}

function handleDocumentFocus(event: Event) {
  const modal = topModal()
  if (!(event.target instanceof Node) || modal?.dialog.contains(event.target)) return
  focusTopModal()
}

function blockOutsideModalInteraction(event: Event) {
  const modal = topModal()
  if (
    !modal ||
    !(event.target instanceof Node) ||
    modal.interactionRoot.contains(event.target)
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function registerModal(
  dialog: HTMLElement,
  interactionRoot: HTMLElement,
  restoreFocusTarget: HTMLElement | null,
) {
  const ownerDocument = dialog.ownerDocument
  const previousModal = topModal()
  const entry = {
    dialog,
    interactionRoot,
    restoreFocusTargets: [
      ...(restoreFocusTarget ? [restoreFocusTarget] : []),
      ...(previousModal?.restoreFocusTargets ?? []),
    ],
  }

  if (modalStack.length === 0) {
    const root = ownerDocument.documentElement
    const body = ownerDocument.body
    modalDocument = ownerDocument
    previousScrollStyles = {
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
    }
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'contain'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'contain'
    ownerDocument.addEventListener('focusin', handleDocumentFocus, true)
    ownerDocument.addEventListener(
      'pointerdown',
      blockOutsideModalInteraction,
      true,
    )
    ownerDocument.addEventListener('click', blockOutsideModalInteraction, true)
  }

  modalStack.push(entry)

  return () => {
    const entryIndex = modalStack.indexOf(entry)
    if (entryIndex < 0) return

    const wasTopModal = entryIndex === modalStack.length - 1
    modalStack.splice(entryIndex, 1)

    if (modalStack.length > 0) {
      if (wasTopModal) {
        const remainingModal = topModal()
        if (
          !remainingModal ||
          !restoreFocus(entry.restoreFocusTargets, remainingModal.dialog)
        ) {
          focusTopModal()
        }
      }
      return
    }

    const documentToRestore = modalDocument
    const stylesToRestore = previousScrollStyles
    modalDocument = null
    previousScrollStyles = null

    if (documentToRestore && stylesToRestore) {
      documentToRestore.removeEventListener('focusin', handleDocumentFocus, true)
      documentToRestore.removeEventListener(
        'pointerdown',
        blockOutsideModalInteraction,
        true,
      )
      documentToRestore.removeEventListener(
        'click',
        blockOutsideModalInteraction,
        true,
      )
      documentToRestore.documentElement.style.overflow =
        stylesToRestore.rootOverflow
      documentToRestore.documentElement.style.overscrollBehavior =
        stylesToRestore.rootOverscrollBehavior
      documentToRestore.body.style.overflow = stylesToRestore.bodyOverflow
      documentToRestore.body.style.overscrollBehavior =
        stylesToRestore.bodyOverscrollBehavior
    }

    restoreFocus(entry.restoreFocusTargets)
  }
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
  const overlayRef = useRef<HTMLDivElement>(null)
  const pointerStartYRef = useRef<number | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const restoreFocusTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const dialog = dialogRef.current
    const interactionRoot = overlayRef.current
    if (!dialog || !interactionRoot) return
    const unregisterModal = registerModal(
      dialog,
      interactionRoot,
      restoreFocusTarget,
    )

    const initialFocus =
      initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog
    initialFocus?.focus()

    return unregisterModal
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
      ref={overlayRef}
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
          {dismissible ? (
            <button
              aria-label={'Dialog schlie\u00dfen'}
              className="responsive-dialog__close"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </button>
          ) : null}
        </header>
        <div className="responsive-dialog__content">{children}</div>
        {actions ? <footer className="responsive-dialog__actions">{actions}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
