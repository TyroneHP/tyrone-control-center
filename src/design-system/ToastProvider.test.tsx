import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast, type ToastApi } from './ToastProvider'

function ToastHarness({ onReady }: { onReady: (toast: ToastApi) => void }) {
  const toast = useToast()

  useEffect(() => {
    onReady(toast)
  }, [onReady, toast])

  return null
}

function renderToasts() {
  let toast: ToastApi | undefined

  render(
    <ToastProvider>
      <ToastHarness onReady={(api) => (toast = api)} />
    </ToastProvider>,
  )

  return {
    show(input: Parameters<ToastApi['show']>[0]) {
      if (!toast) throw new Error('Toast API is not ready')
      return toast.show(input)
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ToastProvider', () => {
  it.each(['success', 'warning', 'error'] as const)(
    'renders %s with an icon and readable text',
    (variant) => {
      const { show } = renderToasts()

      act(() => {
        show({ message: `${variant} Nachricht`, variant })
      })

      const toast = screen.getByText(`${variant} Nachricht`).closest('.toast')
      expect(toast).not.toBeNull()
      expect(within(toast as HTMLElement).getByTestId('toast-icon')).toBeVisible()
      if (variant === 'error') {
        expect(toast).toHaveAttribute('role', 'alert')
      } else {
        expect(toast).toHaveAttribute('role', 'status')
        expect(toast).toHaveAccessibleName()
      }
    },
  )

  it('places the live stack at the top center', () => {
    const { show } = renderToasts()

    act(() => {
      show({ message: 'Gespeichert' })
    })

    expect(screen.getByLabelText('Benachrichtigungen')).toHaveClass('toast-stack')
  })

  it('removes a toast automatically after five seconds', () => {
    vi.useFakeTimers()
    const { show } = renderToasts()

    act(() => {
      show({ message: 'Zeitgesteuert' })
    })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText('Zeitgesteuert')).not.toBeInTheDocument()
  })

  it('runs an optional action exactly once and closes the toast', () => {
    const onAction = vi.fn()
    const { show } = renderToasts()

    act(() => {
      show({ action: { label: 'Erneut versuchen', onAction }, message: 'Fehler' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Fehler')).not.toBeInTheDocument()
  })

  it('shows no more than three and promotes queued messages FIFO', () => {
    const { show } = renderToasts()

    act(() => {
      ;['Erste', 'Zweite', 'Dritte', 'Vierte', 'Fünfte'].forEach((message) =>
        show({ duration: 0, message }),
      )
    })

    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.queryByText('Vierte')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Benachrichtigung schließen' })[0])
    expect(screen.getByText('Vierte')).toBeInTheDocument()
    expect(screen.queryByText('Fünfte')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Benachrichtigung schließen' })[0])
    expect(screen.getByText('Fünfte')).toBeInTheDocument()
  })

  it('supports manual close with an accessible label', () => {
    const { show } = renderToasts()

    act(() => {
      show({ message: 'Schließbar' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Benachrichtigung schließen' }))
    expect(screen.queryByText('Schließbar')).not.toBeInTheDocument()
  })
})
