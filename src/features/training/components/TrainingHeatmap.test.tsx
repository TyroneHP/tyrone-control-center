import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HeatmapDay } from '../analytics/heatmapAnalytics'
import { TrainingHeatmap } from './TrainingHeatmap'
import '../training.css'

const DAYS: HeatmapDay[] = [{
  date: '2026-07-10', completedSetCount: 8,
  hasCompleteWorkout: true, hasIncompleteWorkout: true,
  workouts: [],
}]

describe('TrainingHeatmap', () => {
  it('shows non-color status, large controls and selects a local day', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<TrainingHeatmap days={DAYS} onSelect={onSelect} />)

    const day = screen.getByRole('button', {
      name: /10\. Juli 2026.*8 abgeschlossene Sätze.*vollständig.*unvollständig/i,
    })
    expect(day).toHaveClass('has-complete', 'has-incomplete')
    expect(day).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
    expect(day).toHaveTextContent('✓')
    expect(day).toHaveTextContent('!')
    await user.click(day)
    expect(onSelect).toHaveBeenCalledWith('2026-07-10')
  })

  it('renders an honest empty state', () => {
    render(<TrainingHeatmap days={[]} onSelect={vi.fn()} />)
    expect(screen.getByText('Keine Trainingsaktivität in diesem Zeitraum.')).toBeInTheDocument()
  })
})
