import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
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
  restoreFocusFallbackRef?: RefObject<HTMLElement | null>
  title: string
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(', ')

const SWIPE_DISMISS_DISTANCE = 72
const SWIPE_OFFSET_PROPERTY = '--responsive-dialog-drag-y'

interface ActiveSwipe {
  captureTarget: HTMLDivElement
  pointerId: number
  startX: number
  startY: number
}

// eslint-disable-next-line react-refresh/only-export-components
export function isValidDialogFocusTarget(
  element: HTMLElement | null,
): element is HTMLElement {
  if (
    !element ||
    !element.isConnected ||
    element.matches(':disabled, [disabled]') ||
    Boolean(element.closest('[hidden], [aria-hidden="true"], [inert]')) ||
    (!element.matches(focusableSelector) &&
      (!element.hasAttribute('tabindex') || element.tabIndex < -1))
  ) {
    return false
  }

  const view = element.ownerDocument.defaultView
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const styles = view?.getComputedStyle(current)
    if (
      styles?.display === 'none' ||
      styles?.visibility === 'hidden' ||
      styles?.visibility === 'collapse' ||
      styles?.contentVisibility === 'hidden'
    ) {
      return false
    }
  }

  return true
}

// eslint-disable-next-line react-refresh/only-export-components
export function focusDialogTarget(target: HTMLElement | null) {
  if (!isValidDialogFocusTarget(target)) return false

  target.focus()
  return target.ownerDocument.activeElement === target
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return []

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0 && isValidDialogFocusTarget(element),
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
  if (
    activeElement instanceof HTMLElement &&
    modal.dialog.contains(activeElement) &&
    isValidDialogFocusTarget(activeElement)
  ) {
    return
  }

  for (const target of [...getFocusableElements(modal.dialog), modal.dialog]) {
    if (focusDialogTarget(target)) return
  }
}

function restoreFocus(
  targets: HTMLElement[],
  within: HTMLElement | null = null,
) {
  for (const target of targets) {
    if (within && !within.contains(target)) continue
    if (focusDialogTarget(target)) return true
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
  restoreFocusFallbackTarget: HTMLElement | null,
) {
  const ownerDocument = dialog.ownerDocument
  const previousModal = topModal()
  const entry = {
    dialog,
    interactionRoot,
    restoreFocusTargets: [
      ...(restoreFocusTarget ? [restoreFocusTarget] : []),
      ...(previousModal?.restoreFocusTargets ?? []),
      ...(restoreFocusFallbackTarget ? [restoreFocusFallbackTarget] : []),
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
  restoreFocusFallbackRef,
  title,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const dialogRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const activeSwipeRef = useRef<ActiveSwipe | null>(null)
  const titleId = useId()

  const resetSwipeGesture = useCallback(() => {
    const activeSwipe = activeSwipeRef.current
    activeSwipeRef.current = null
    dialogRef.current?.style.removeProperty(SWIPE_OFFSET_PROPERTY)

    if (!activeSwipe) return

    try {
      if (activeSwipe.captureTarget.hasPointerCapture?.(activeSwipe.pointerId)) {
        activeSwipe.captureTarget.releasePointerCapture?.(activeSwipe.pointerId)
      }
    } catch {
      // The browser may already have released capture while cancelling the pointer.
    }
  }, [])

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
      restoreFocusFallbackRef?.current ?? null,
    )

    const initialFocusTargets = [
      initialFocusRef?.current ?? null,
      ...getFocusableElements(dialog),
      dialog,
    ]
    for (const target of initialFocusTargets) {
      if (focusDialogTarget(target)) break
    }

    return () => {
      resetSwipeGesture()
      unregisterModal()
    }
  }, [initialFocusRef, open, resetSwipeGesture, restoreFocusFallbackRef])

  useEffect(() => {
    if (!open || typeof MutationObserver === 'undefined') return

    const dialog = dialogRef.current
    if (!dialog) return

    const observer = new MutationObserver(() => {
      if (topModal()?.dialog !== dialog) return
      focusTopModal()
    })
    observer.observe(dialog, {
      attributes: true,
      attributeFilter: [
        'aria-hidden',
        'class',
        'disabled',
        'hidden',
        'inert',
        'style',
        'tabindex',
      ],
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (!dismissible || !isMobile) resetSwipeGesture()
  }, [dismissible, isMobile, resetSwipeGesture])

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
      focusDialogTarget(dialogRef.current)
      return
    }

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault()
      focusDialogTarget(last)
    } else if (!event.shiftKey && currentIndex === focusableElements.length - 1) {
      event.preventDefault()
      focusDialogTarget(first)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!dismissible || !isMobile || activeSwipeRef.current) return

    activeSwipeRef.current = {
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Pointer tracking still works while the pointer remains over the handle.
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeSwipe = activeSwipeRef.current
    if (!activeSwipe || activeSwipe.pointerId !== event.pointerId) return

    const deltaX = event.clientX - activeSwipe.startX
    const deltaY = event.clientY - activeSwipe.startY
    const dragY = deltaY > 0 && deltaY > Math.abs(deltaX) ? deltaY : 0

    if (dragY > 0) {
      dialogRef.current?.style.setProperty(SWIPE_OFFSET_PROPERTY, `${dragY}px`)
    } else {
      dialogRef.current?.style.removeProperty(SWIPE_OFFSET_PROPERTY)
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activeSwipe = activeSwipeRef.current
    if (!activeSwipe || activeSwipe.pointerId !== event.pointerId) return

    const deltaX = event.clientX - activeSwipe.startX
    const deltaY = event.clientY - activeSwipe.startY
    const shouldClose =
      deltaY >= SWIPE_DISMISS_DISTANCE && deltaY > Math.abs(deltaX)

    resetSwipeGesture()
    if (shouldClose) onClose()
  }

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (activeSwipeRef.current?.pointerId === event.pointerId) resetSwipeGesture()
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
            className={`responsive-dialog__drag-handle${
              dismissible ? ' responsive-dialog__drag-handle--swipeable' : ''
            }`}
            data-testid="responsive-dialog-drag-handle"
            onLostPointerCapture={handlePointerCancel}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
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
