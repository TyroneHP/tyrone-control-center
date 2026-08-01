import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BarChart } from './BarChart'

describe('BarChart', () => {
  it('provides labeled bars, complete alternatives and keyboard selection', () => {
    const onSelect = vi.fn()
    render(
      <BarChart
        ariaLabel="Gewichtete Sätze"
        data={[
          { id: 'chest', label: 'Brust', value: 12 },
          { id: 'back', label: 'Rücken', value: 8 },
        ]}
        onSelect={onSelect}
        unit="Sätze"
      />,
    )

    expect(screen.getByRole('img', { name: 'Gewichtete Sätze' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Werte: Gewichtete Sätze' }).children).toHaveLength(2)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Brust: 12 Sätze' }), { key: ' ' })
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'chest' }))
  })
})
