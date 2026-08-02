import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseFilterSheet, type ExerciseFilters } from './ExerciseFilterSheet'

describe('ExerciseFilterSheet', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }))
  })
  it('applies favorite and muscle filters through toggle buttons', async () => {
    function Harness() {
      const [filters, setFilters] = useState<ExerciseFilters>({ favoritesOnly: false, muscle: null, equipment: null })
      return <><output data-testid="filters">{JSON.stringify(filters)}</output><ExerciseFilterSheet filters={filters} onChange={setFilters} onClose={() => undefined} open /></>
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Nur Favoriten' }))
    await user.click(screen.getByRole('button', { name: 'Brust filtern' }))
    expect(screen.getByTestId('filters')).toHaveTextContent('"favoritesOnly":true')
    expect(screen.getByTestId('filters')).toHaveTextContent('"muscle":"Brust"')
  })
})
