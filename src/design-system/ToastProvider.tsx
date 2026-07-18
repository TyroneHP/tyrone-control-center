import {
  CheckCircle2,
  CircleX,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ToastVariant = 'success' | 'warning' | 'error' | 'neutral'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ShowToastInput {
  action?: ToastAction
  duration?: number
  message: string
  variant?: ToastVariant
}

export interface ToastApi {
  dismiss: (id: string) => void
  show: (input: ShowToastInput) => string
}

interface Toast extends Required<Pick<ShowToastInput, 'duration' | 'message'>> {
  action?: ToastAction
  id: string
  variant: ToastVariant
}

const DEFAULT_DURATION = 5000
const MAX_VISIBLE_TOASTS = 3
const ToastContext = createContext<ToastApi | null>(null)

const toastPresentation = {
  error: { Icon: CircleX, label: 'Fehler', role: 'alert' },
  neutral: { Icon: Info, label: 'Information', role: 'status' },
  success: { Icon: CheckCircle2, label: 'Erfolg', role: 'status' },
  warning: { Icon: TriangleAlert, label: 'Warnung', role: 'status' },
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<string, number>())
  const handledActions = useRef(new Set<string>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    handledActions.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((input: ShowToastInput) => {
    const id = `toast-${nextId.current++}`
    setToasts((current) => [
      ...current,
      {
        ...input,
        duration: input.duration ?? DEFAULT_DURATION,
        id,
        variant: input.variant ?? 'neutral',
      },
    ])
    return id
  }, [])

  const visibleToasts = toasts.slice(0, MAX_VISIBLE_TOASTS)

  useEffect(() => {
    const visibleIds = new Set(visibleToasts.map(({ id }) => id))

    timers.current.forEach((timer, id) => {
      if (!visibleIds.has(id)) {
        window.clearTimeout(timer)
        timers.current.delete(id)
      }
    })

    visibleToasts.forEach(({ duration, id }) => {
      if (duration <= 0 || timers.current.has(id)) return
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
    })
  }, [dismiss, visibleToasts])

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer))
      timers.current.clear()
    },
    [],
  )

  const api = useMemo<ToastApi>(() => ({ dismiss, show }), [dismiss, show])

  const content =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <div aria-label="Benachrichtigungen" className="toast-stack">
            {visibleToasts.map((toast) => {
              const { Icon, label, role } = toastPresentation[toast.variant]

              return (
                <div
                  aria-label={`${label}: ${toast.message}`}
                  className={`toast toast--${toast.variant}`}
                  key={toast.id}
                  role={role}
                >
                  <Icon aria-hidden="true" className="toast__icon" data-testid="toast-icon" />
                  <p className="toast__message">{toast.message}</p>
                  {toast.action && (
                    <button
                      className="toast__action"
                      onClick={() => {
                        if (handledActions.current.has(toast.id)) return
                        handledActions.current.add(toast.id)
                        try {
                          toast.action?.onAction()
                        } finally {
                          dismiss(toast.id)
                        }
                      }}
                      type="button"
                    >
                      {toast.action.label}
                    </button>
                  )}
                  <button
                    aria-label="Benachrichtigung schließen"
                    className="toast__close"
                    onClick={() => dismiss(toast.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {content}
    </ToastContext.Provider>
  )
}

// The hook shares the provider module so consumers have one public entry point.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast muss innerhalb eines ToastProvider verwendet werden.')
  return toast
}
