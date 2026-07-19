import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CalendarPage } from './CalendarPage'

describe('CalendarPage', () => {
  it('navigates across a year boundary without changing today', async () => {
    const user = userEvent.setup()
    render(<CalendarPage today={new Date(2026, 11, 18)} />)

    expect(
      screen.getByRole('heading', { name: 'Dezember 2026' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(
      screen.getByRole('heading', { name: 'Januar 2027' }),
    ).toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent(
      '18',
    )
  })
})
