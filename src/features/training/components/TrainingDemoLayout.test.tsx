import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrainingDemoLayout } from './TrainingDemoLayout'

describe('TrainingDemoLayout', () => {
  it('shows only Dashboard, Pläne and Bibliothek internally', () => {
    render(<TrainingDemoLayout />)

    expect(screen.getByRole('navigation', { name: 'Training' })).toHaveTextContent(
      'DashboardPläneBibliothek',
    )
  })
})
