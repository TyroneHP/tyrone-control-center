import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarEventDialog } from './CalendarEventDialog'

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      media: '',
      removeEventListener: vi.fn(),
    })),
  )
}

describe('CalendarEventDialog', () => {
  beforeEach(installMatchMedia)

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates and submits a trimmed create draft', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CalendarEventDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    const title = screen.getByLabelText('Titel')
    expect(await screen.findByText('Bitte gib einen Titel ein.')).toBeInTheDocument()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAttribute('aria-describedby', 'calendar-event-title-error')
    expect(document.getElementById('calendar-event-title-error')).toHaveClass(
      'form-field__error',
    )

    await user.type(title, '  Arzt  ')
    await user.type(screen.getByLabelText('Startzeit'), '10:00')
    await user.type(screen.getByLabelText('Endzeit'), '09:00')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    expect(
      await screen.findByText('Die Endzeit darf nicht vor der Startzeit liegen.'),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Endzeit'))
    await user.type(screen.getByLabelText('Endzeit'), '11:00')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    expect(onSave).toHaveBeenCalledWith({
      title: 'Arzt',
      date: '2026-07-20',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('prefills editing, focuses the title, and exposes delete separately', async () => {
    const user = userEvent.setup()
    const onRequestDelete = vi.fn()
    render(
      <CalendarEventDialog
        event={{ id: 'event-1', title: 'Arzt', date: '2026-07-20' }}
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onRequestDelete={onRequestDelete}
        onSave={vi.fn()}
        open
      />,
    )

    const title = screen.getByLabelText('Titel')
    expect(title).toHaveValue('Arzt')
    expect(title).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Termin löschen' }))

    expect(onRequestDelete).toHaveBeenCalledOnce()
  })

  it('resets its values when opened for another date', () => {
    const { rerender } = render(
      <CalendarEventDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />,
    )

    rerender(
      <CalendarEventDialog
        initialDate="2026-07-21"
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />,
    )

    expect(screen.getByLabelText('Datum')).toHaveValue('2026-07-21')
  })
})
