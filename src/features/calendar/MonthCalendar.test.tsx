import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar } from './MonthCalendar'

describe('MonthCalendar', () => {
  it('renders a German semantic month table and marks today', () => {
    render(
      <MonthCalendar
        month={new Date(2026, 6, 1)}
        onNextMonth={vi.fn()}
        onPreviousMonth={vi.fn()}
        today={new Date(2026, 6, 16)}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Juli 2026' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Monatskalender Juli 2026' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent(
      '16',
    )
  })

  it('exposes accessible previous and next month actions', async () => {
    const user = userEvent.setup()
    const onPreviousMonth = vi.fn()
    const onNextMonth = vi.fn()
    render(
      <MonthCalendar
        month={new Date(2026, 6, 1)}
        onNextMonth={onNextMonth}
        onPreviousMonth={onPreviousMonth}
        today={new Date(2026, 6, 16)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(onPreviousMonth).toHaveBeenCalledOnce()
    expect(onNextMonth).toHaveBeenCalledOnce()
  })
})
