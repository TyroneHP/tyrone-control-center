import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LineChart } from './LineChart'

describe('LineChart', () => {
  it('renders an accessible empty state', () => {
    render(<LineChart ariaLabel="Gewichtsverlauf" data={[]} unit="kg" />)
    expect(screen.getByText('Keine Diagrammdaten vorhanden.')).toBeInTheDocument()
  })

  it('keeps a complete value list and exposes selected point details', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <LineChart
        ariaLabel="Gewichtsverlauf"
        data={[
          { id: 'one', label: '1. Juli', value: 80, description: 'Training A' },
          { id: 'two', label: '8. Juli', value: 82.5, description: 'Training B' },
        ]}
        onSelect={onSelect}
        unit="kg"
      />,
    )

    expect(screen.getByRole('img', { name: 'Gewichtsverlauf' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Werte: Gewichtsverlauf' }).children).toHaveLength(2)
    const point = screen.getByRole('button', { name: '8. Juli: 82,5 kg' })
    await user.click(point)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'two' }))
    expect(screen.getByRole('status')).toHaveTextContent('Training B')
  })

  it('supports keyboard point selection', () => {
    const onSelect = vi.fn()
    render(<LineChart ariaLabel="Volumen" data={[{ id: 'one', label: 'Heute', value: 500 }]} onSelect={onSelect} unit="kg" />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Heute: 500 kg' }), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
