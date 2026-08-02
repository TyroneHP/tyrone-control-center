import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseFilterSheet, filterDemoExercises, type ExerciseFilters } from './ExerciseFilterSheet'
import { createInitialTrainingDemoState } from '../demo/mockTrainingData'
import { STANDARD_EXERCISES } from '../model/exerciseCatalog'

describe('ExerciseFilterSheet', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }))
  })
  it('applies favorite and muscle filters through toggle buttons', async () => {
    function Harness() {
      const [filters, setFilters] = useState<ExerciseFilters>({ favoritesOnly: false, muscle: null, equipment: null })
      return <><output data-testid="filters">{JSON.stringify(filters)}</output><ExerciseFilterSheet exercises={createInitialTrainingDemoState().exercises} filters={filters} onChange={setFilters} onClose={() => undefined} open /></>
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Nur Favoriten' }))
    await user.click(screen.getByRole('button', { name: 'Brust filtern' }))
    expect(screen.getByTestId('filters')).toHaveTextContent('"favoritesOnly":true')
    expect(screen.getByTestId('filters')).toHaveTextContent('"muscle":"Brust"')
  })

  it('offers every catalog muscle and equipment value and each option filters a matching subset', async () => {
    const exercises = createInitialTrainingDemoState().exercises
    const expectedMuscles = [...new Set(STANDARD_EXERCISES.flatMap(({ primaryMuscles }) => primaryMuscles.slice(0, 1)))].sort((a, b) => a.localeCompare(b, 'de'))
    const expectedEquipment = [...new Set(STANDARD_EXERCISES.flatMap(({ equipment }) => equipment))].sort((a, b) => a.localeCompare(b, 'de'))
    const changes: ExerciseFilters[] = []
    render(<ExerciseFilterSheet exercises={exercises} filters={{ favoritesOnly: false, muscle: null, equipment: null }} onChange={(filters) => changes.push(filters)} onClose={() => undefined} open />)
    const user = userEvent.setup()

    for (const muscle of expectedMuscles) {
      await user.click(screen.getByRole('button', { name: `${muscle} filtern` }))
      const expected = exercises.filter((exercise) => exercise.muscle === muscle)
      expect(filterDemoExercises(exercises, { favoritesOnly: false, muscle, equipment: null }, [], '')).toEqual(expected)
      expect(expected).not.toHaveLength(0)
    }
    for (const item of expectedEquipment) {
      await user.click(screen.getByRole('button', { name: `${item} filtern` }))
      const expected = exercises.filter((exercise) => exercise.equipment.split(', ').includes(item))
      expect(filterDemoExercises(exercises, { favoritesOnly: false, muscle: null, equipment: item }, [], '')).toEqual(expected)
      expect(expected).not.toHaveLength(0)
    }

    expect(screen.getByRole('region', { name: 'Muskelgruppen' }).getElementsByTagName('button')).toHaveLength(expectedMuscles.length)
    expect(screen.getByRole('region', { name: 'Ausrüstung' }).getElementsByTagName('button')).toHaveLength(expectedEquipment.length)
    expect(changes).toHaveLength(expectedMuscles.length + expectedEquipment.length)
  })
})
