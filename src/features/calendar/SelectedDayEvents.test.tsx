import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SelectedDayEvents } from './SelectedDayEvents'

it('shows full selected-day details and edits the chosen event', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const events = [
    { id: 'untimed', title: 'Einkaufen', date: '2026-07-20', description: 'Milch' },
    { id: 'timed', title: 'Arzt', date: '2026-07-20', startTime: '10:00', endTime: '11:00' },
  ]
  render(<SelectedDayEvents date="2026-07-20" events={events} onEdit={onEdit} />)

  expect(
    screen.getByRole('heading', { name: 'Termine am 20. Juli 2026' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Einkaufen')).toBeInTheDocument()
  expect(screen.getByText('Milch')).toBeInTheDocument()
  expect(screen.getByText('10:00–11:00')).toBeInTheDocument()

  const editAction = screen.getByRole('button', { name: 'Arzt bearbeiten' })
  expect(editAction).toHaveClass('button')
  await user.click(editAction)

  expect(onEdit).toHaveBeenCalledWith(events[1])
})

it('shows the German empty state', () => {
  render(<SelectedDayEvents date="2026-07-20" events={[]} onEdit={vi.fn()} />)

  expect(
    screen.getByText('Für diesen Tag sind keine Termine eingetragen.'),
  ).toBeInTheDocument()
})
