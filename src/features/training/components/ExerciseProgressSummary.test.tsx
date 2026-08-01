import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { CompletedWorkout, ExerciseDefinition } from '../model/trainingTypes'
import { ExerciseProgressSummary } from './ExerciseProgressSummary'

const EXERCISE: ExerciseDefinition = {
  id: 'bench', source: 'standard', name: 'Bankdrücken',
  primaryMuscles: ['Brust'], secondaryMuscles: ['Trizeps'],
  equipment: ['Langhantel'], unit: 'kg-reps', description: '', gripOptions: [],
  supportsBodyweightModes: false,
}

function workout(id: string, date: string, weightKg: number): CompletedWorkout {
  return {
    id, name: id, startedAt: `${date}T09:00:00.000Z`,
    completedAt: `${date}T10:00:00.000Z`,
    exercises: [{
      id: `${id}-exercise`, exerciseId: 'bench', order: 0, targetSets: 1,
      repMin: 8, repMax: 12, loadMode: 'external', note: '',
      exerciseSnapshot: {
        exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
        secondaryMuscles: ['Trizeps'], unit: 'kg-reps', supportsBodyweightModes: false,
      },
      sets: [{ id: `${id}-set`, weightKg, reps: 10, rating: 8, completed: true }],
    }],
  }
}

describe('ExerciseProgressSummary', () => {
  it('shows applicable records, latest trend, a small chart and reloadable analysis link', () => {
    render(
      <MemoryRouter>
        <ExerciseProgressSummary
          exercise={EXERCISE}
          workouts={[workout('alt', '2026-07-20', 80), workout('neu', '2026-07-25', 85)]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Gewichtsrekord').nextElementSibling).toHaveTextContent('85 kg')
    expect(screen.getByText('Satzvolumen-Rekord').nextElementSibling).toHaveTextContent('850 kg')
    expect(screen.getByText('Wiederholungsrekord').nextElementSibling).toHaveTextContent('10')
    expect(screen.getByText(/Trend.*5 kg/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kompakter Gewichtsverlauf Bankdrücken' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vollständige Analyse öffnen' })).toHaveAttribute('href', '/training/progress/exercises?exercise=bench')
  })

  it('omits unsupported records and never renders a broken empty chart', () => {
    const plank = { ...EXERCISE, id: 'plank', name: 'Plank', unit: 'seconds' as const }
    render(<MemoryRouter><ExerciseProgressSummary exercise={plank} workouts={[]} /></MemoryRouter>)

    expect(screen.queryByText('Gewichtsrekord')).not.toBeInTheDocument()
    expect(screen.getByText('Noch keine Fortschrittsdaten vorhanden.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows snapshot-based load records for bodyweight exercises', () => {
    const pullUp = {
      ...EXERCISE,
      id: 'pull-up',
      name: 'Klimmzug',
      unit: 'reps' as const,
      supportsBodyweightModes: true,
    }
    const history = workout('pull-up-workout', '2026-07-25', 0)
    history.exercises[0] = {
      ...history.exercises[0],
      exerciseId: 'pull-up',
      exerciseSnapshot: {
        exerciseId: 'pull-up', name: 'Klimmzug', primaryMuscles: ['Latissimus'],
        secondaryMuscles: ['Bizeps'], unit: 'reps', supportsBodyweightModes: true,
      },
      loadMode: 'bodyweight',
      bodyWeightSnapshot: {
        weightKg: 80, sourceDate: '2026-07-25', capturedAt: '2026-07-25T10:00:00Z',
      },
      sets: [{ ...history.exercises[0].sets[0], weightKg: null, reps: 8 }],
    }

    render(<MemoryRouter><ExerciseProgressSummary exercise={pullUp} workouts={[history]} /></MemoryRouter>)

    expect(screen.getByText('Gewichtsrekord').nextElementSibling).toHaveTextContent('80 kg')
    expect(screen.getByText('Satzvolumen-Rekord').nextElementSibling).toHaveTextContent('640 kg')
    expect(screen.getByRole('img', { name: 'Kompakter Gewichtsverlauf Klimmzug' })).toBeInTheDocument()
  })

  it('uses local calendar dates when deriving the compact chart range', () => {
    const crossingMidnight = workout('timezone', '2026-07-20', 80)
    crossingMidnight.completedAt = '2026-07-20T23:30:00-03:00'

    render(<MemoryRouter><ExerciseProgressSummary exercise={EXERCISE} workouts={[crossingMidnight]} /></MemoryRouter>)

    expect(screen.getByRole('img', { name: 'Kompakter Gewichtsverlauf Bankdrücken' })).toBeInTheDocument()
  })
})
