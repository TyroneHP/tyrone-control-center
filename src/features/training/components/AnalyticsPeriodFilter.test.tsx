import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnalyticsPeriodFilter } from './AnalyticsPeriodFilter'

describe('AnalyticsPeriodFilter', () => {
  it('emits preset changes immediately', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AnalyticsPeriodFilter onChange={onChange} value={{ preset: '30d' }} />)

    await user.selectOptions(screen.getByLabelText('Zeitraum'), '3m')
    expect(onChange).toHaveBeenLastCalledWith({ preset: '3m' })
  })

  it('emits a custom range only when both inclusive bounds are valid', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AnalyticsPeriodFilter onChange={onChange} value={{ preset: '30d' }} />)

    await user.selectOptions(screen.getByLabelText('Zeitraum'), 'custom')
    await user.type(screen.getByLabelText('Startdatum'), '2026-07-30')
    await user.type(screen.getByLabelText('Enddatum'), '2026-07-29')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Das Startdatum darf nicht nach dem Enddatum liegen.',
    )
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom' }))

    await user.clear(screen.getByLabelText('Startdatum'))
    await user.type(screen.getByLabelText('Startdatum'), '2026-07-01')
    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'custom', startDate: '2026-07-01', endDate: '2026-07-29',
    })
  })
})
