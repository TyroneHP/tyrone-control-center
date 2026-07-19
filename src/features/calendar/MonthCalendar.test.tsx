import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar } from './MonthCalendar'

describe('MonthCalendar', () => {
  it('renders a German semantic month table and marks today', () => {
    render(
      <MonthCalendar
        events={[]}
        month={new Date(2026, 6, 1)}
        onNextMonth={vi.fn()}
        onPreviousMonth={vi.fn()}
        onSelectDate={vi.fn()}
        selectedDate="2026-07-16"
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
        events={[]}
        month={new Date(2026, 6, 1)}
        onNextMonth={onNextMonth}
        onPreviousMonth={onPreviousMonth}
        onSelectDate={vi.fn()}
        selectedDate="2026-07-16"
        today={new Date(2026, 6, 16)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(onPreviousMonth).toHaveBeenCalledOnce()
    expect(onNextMonth).toHaveBeenCalledOnce()
  })

  it('declares CSS that makes each date button fill its table cell', () => {
    const styles = readFileSync('src/features/calendar/calendar.css', 'utf8')

    expect(styles).toMatch(/\.month-calendar__day\s*{[^}]*height:\s*1px;/)
    expect(styles).toMatch(
      /\.month-calendar__day-button\s*{[^}]*height:\s*100%;/,
    )
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 767px)'))
    expect(mobileStyles).not.toMatch(
      /\.month-calendar__day\s*{[^}]*height\s*:/,
    )
  })

  it('renders events on the correct date and exposes date selection', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    render(
      <MonthCalendar
        events={[
          { id: 'event-1', title: 'Arzt', date: '2026-07-16', startTime: '10:00' },
          { id: 'event-2', title: 'Training', date: '2026-07-17' },
        ]}
        month={new Date(2026, 6, 1)}
        onNextMonth={vi.fn()}
        onPreviousMonth={vi.fn()}
        onSelectDate={onSelectDate}
        selectedDate="2026-07-16"
        today={new Date(2026, 6, 16)}
      />,
    )

    const selectedDay = screen.getByRole('button', {
      name: /Donnerstag, 16. Juli 2026, 1 Termin/,
    })
    expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
    expect(within(selectedDay).getByText('Arzt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Freitag, 17. Juli 2026, 1 Termin/ }))
      .not.toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Freitag, 17. Juli 2026/ }))
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-17')
  })
})
