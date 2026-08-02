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

function FreeSessionProbe() {
  const { dispatch, startFreeSession, state } = useTrainingDemo()

  return (
    <>
      <button
        onClick={() => dispatch({ type: 'session/discard' })}
        type="button"
      >
        Aktives Training verwerfen
      </button>
      <button onClick={startFreeSession} type="button">
        Freies Training starten
      </button>
      <output aria-label="Aktive Trainingseinheit">
        {state.activeSession?.name ?? 'Kein aktives Training'}
      </output>
    </>
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

  it('exposes the typed action for starting a free demo session', async () => {
    const user = userEvent.setup()
    render(
      <TrainingDemoProvider>
        <FreeSessionProbe />
      </TrainingDemoProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Aktives Training verwerfen' }))
    await user.click(screen.getByRole('button', { name: 'Freies Training starten' }))

    expect(screen.getByLabelText('Aktive Trainingseinheit')).toHaveTextContent(
      'Freies Training',
    )
  })
})
