import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { TrainingDemoExercise, TrainingDemoPlanExercise } from '../demo/trainingDemoTypes'
import { PlanExerciseEditorRow } from './PlanExerciseEditorRow'

const exercise: TrainingDemoExercise = { id: 'bench-press', name: 'Bankdrücken', muscle: 'Brust', equipment: 'Langhantel', illustrationPath: 'training/exercises/bench-press.svg', gripOptions: ['Breit'] }
const entry: TrainingDemoPlanExercise = { id: 'draft-bench-press', exerciseId: 'bench-press', order: 0, targetSets: 3, repMin: 8, repMax: 12 }

describe('PlanExerciseEditorRow', () => {
  it('exposes the default 3 × 8–12 values and removes through an accessible action', async () => {
    function Harness() {
      const [visible, setVisible] = useState(true)
      return visible ? <PlanExerciseEditorRow entry={entry} exercise={exercise} index={0} itemCount={1} onMove={() => undefined} onRemove={() => setVisible(false)} onUpdate={() => undefined} /> : <p>Übung entfernt</p>
    }
    render(<Harness />)
    expect(screen.getByLabelText('Zielsätze für Bankdrücken')).toHaveValue(3)
    expect(screen.getByLabelText('Wiederholungen von für Bankdrücken')).toHaveValue(8)
    expect(screen.getByLabelText('Wiederholungen bis für Bankdrücken')).toHaveValue(12)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bankdrücken entfernen' }))
    expect(screen.getByText('Übung entfernt')).toBeVisible()
  })
})
