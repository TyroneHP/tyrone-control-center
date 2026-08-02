import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TrainingDemoProvider } from './TrainingDemoProvider'
import { useTrainingDemo } from './useTrainingDemo'

function Probe() {
  const { state, toggleFavoriteExercise } = useTrainingDemo()
  const isFavorite = state.favoriteExerciseIds.includes('bench-press')

  return (
    <button
      type="button"
      aria-label={`Bankdrücken als Favorit ${isFavorite ? 'entfernen' : 'hinzufügen'}`}
      onClick={() => toggleFavoriteExercise('bench-press')}
    >
      Favorit umschalten
    </button>
  )
}

describe('TrainingDemoProvider', () => {
  it('resets deterministic demo data after remount', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TrainingDemoProvider>
        <Probe />
      </TrainingDemoProvider>,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Bankdrücken als Favorit entfernen',
      }),
    )
    rerender(
      <TrainingDemoProvider key="fresh">
        <Probe />
      </TrainingDemoProvider>,
    )

    expect(
      screen.getByRole('button', {
        name: 'Bankdrücken als Favorit entfernen',
      }),
    ).toBeVisible()
  })
})
