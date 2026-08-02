import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrainingSetRow } from './TrainingSetRow'

const demoSet = {
  completed: false,
  reps: 8,
  weight: 60,
}

describe('TrainingSetRow', () => {
  it('labels numeric fields and exposes completed state without color alone', () => {
    render(<TrainingSetRow setNumber={1} value={demoSet} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Satz 1 Gewicht')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Satz 1 abgeschlossen')).toHaveAttribute('aria-pressed', 'false')
  })
})
