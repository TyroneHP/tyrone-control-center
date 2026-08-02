import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActiveExerciseNavigator } from '../components/ActiveExerciseNavigator'
import { FinishDiscardSheet } from '../components/FinishDiscardSheet'
import { TrainingBottomSheet } from '../components/ui/TrainingBottomSheet'
import { TrainingEmptyState } from '../components/ui/TrainingEmptyState'
import { TrainingScreenHeader } from '../components/ui/TrainingScreenHeader'
import { TrainingStickyActionBar } from '../components/ui/TrainingStickyActionBar'
import {
  TrainingSetRow,
  type TrainingSetValue,
} from '../components/ui/TrainingSetRow'
import { useTrainingDemo } from '../demo/useTrainingDemo'

function sessionDuration(startedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000))
  return `${minutes} Min.`
}

export function TrainingActiveSessionPage() {
  const { dispatch, state } = useTrainingDemo()
  const navigate = useNavigate()
  const [sheetAction, setSheetAction] = useState<'discard' | 'finish'>()
  const [gripExerciseId, setGripExerciseId] = useState<string>()
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const session = state.activeSession

  if (!session) {
    return (
      <main aria-label="Aktives Training">
        <TrainingEmptyState
          action={{ label: 'Zur Trainingsübersicht', onClick: () => navigate('/training') }}
          description="Starte ein Training über deine Trainingsübersicht."
          title="Kein aktives Training"
        />
      </main>
    )
  }

  const exercises = [...session.exercises].sort((left, right) => left.order - right.order)
  const currentIndex = Math.max(0, Math.min(session.activeExerciseIndex, exercises.length - 1))
  const currentSessionExercise = exercises[currentIndex]
  const currentExercise = currentSessionExercise
    ? state.exercises.find(({ id }) => id === currentSessionExercise.exerciseId)
    : undefined
  const planExercise = state.plans
    .find(({ id }) => id === session.planId)
    ?.exercises.find(({ exerciseId }) => exerciseId === currentSessionExercise?.exerciseId)
  const selectedGrip = currentSessionExercise?.grip
  const selectedExerciseIds = new Set(session.exercises.map(({ exerciseId }) => exerciseId))

  const resolveSession = (action: 'discard' | 'finish') => {
    dispatch({ type: action === 'finish' ? 'session/finish' : 'session/discard' })
    setSheetAction(undefined)
    navigate('/training')
  }

  return (
    <main aria-label="Aktives Training" className="training-active-session">
      <TrainingScreenHeader
        onBack={() => navigate('/training')}
        subtitle={`Dauer: ${sessionDuration(session.startedAt)}`}
        title={session.name}
      />

      {currentSessionExercise && currentExercise ? (
        <ActiveExerciseNavigator
          currentIndex={currentIndex}
          exerciseCount={exercises.length}
          onIndexChange={(index) => dispatch({ type: 'session/set-active-exercise', index })}
        >
          <article aria-labelledby="active-exercise-heading" className="training-active-session__exercise">
            <img
              alt={`Technische Darstellung: ${currentExercise.name}`}
              src={`${import.meta.env.BASE_URL}${currentExercise.illustrationPath}`}
            />
            <h2 id="active-exercise-heading">{currentExercise.name}</h2>
            <p>Muskelgruppe: {currentExercise.muscle}</p>
            <p>
              Ziel: {planExercise
                ? `${planExercise.targetSets} Sätze · ${planExercise.repMin}–${planExercise.repMax} Wiederholungen`
                : 'Freies Training'}
            </p>
            <p>Letzte Werte: Noch keine gespeicherten Werte verfügbar.</p>
            {currentExercise.gripOptions.length > 0 ? (
              <>
                <p>Griff: {selectedGrip ?? 'Keine Auswahl'}</p>
                <button onClick={() => setGripExerciseId(currentSessionExercise.id)} type="button">
                  Griff wählen
                </button>
              </>
            ) : null}
            <label>
              Notiz
              <textarea
                aria-label={`Notiz für ${currentExercise.name}`}
                onChange={(event) => dispatch({
                  type: 'session/update-exercise',
                  exerciseId: currentSessionExercise.exerciseId,
                  changes: { note: event.target.value },
                })}
                value={currentSessionExercise.note ?? ''}
              />
            </label>
            <ol aria-label={`Sätze für ${currentExercise.name}`}>
              {currentSessionExercise.sets.map((set, index) => {
                const value: TrainingSetValue = {
                  completed: set.completed,
                  rating: set.rating ?? null,
                  reps: set.repetitions,
                  weight: set.weightKg,
                }

                return (
                  <TrainingSetRow
                    key={set.id}
                    onChange={(changes) => {
                      const setChanges: { completed?: boolean; rating?: number | null; repetitions?: number; weightKg?: number } = {}
                      if ('rating' in changes) setChanges.rating = changes.rating ?? null
                      if ('completed' in changes) setChanges.completed = changes.completed
                      if ('reps' in changes) setChanges.repetitions = changes.reps ?? 0
                      if ('weight' in changes) setChanges.weightKg = changes.weight ?? 0
                      if (Object.keys(setChanges).length > 0) {
                        dispatch({
                          type: 'session/update-set',
                          exerciseId: currentSessionExercise.exerciseId,
                          setId: set.id,
                          changes: setChanges,
                        })
                      }
                    }}
                    onDelete={() => dispatch({
                      type: 'session/remove-set',
                      exerciseId: currentSessionExercise.exerciseId,
                      setId: set.id,
                    })}
                    setNumber={index + 1}
                    showRating
                    value={value}
                  />
                )
              })}
            </ol>
            <button
              aria-label={`Satz hinzufügen: ${currentExercise.name}`}
              onClick={() => dispatch({
                type: 'session/add-set',
                exerciseId: currentSessionExercise.exerciseId,
              })}
              type="button"
            >
              Satz hinzufügen
            </button>
            {session.planId === 'free-training' ? (
              <button
                aria-label={`${currentExercise.name} entfernen`}
                onClick={() => dispatch({ type: 'session/remove-exercise', exerciseId: currentExercise.id })}
                type="button"
              >
                Übung entfernen
              </button>
            ) : null}
          </article>
        </ActiveExerciseNavigator>
      ) : (
        <TrainingEmptyState
          action={{ label: 'Übung hinzufügen', onClick: () => setExercisePickerOpen(true) }}
          description="Füge im freien Training zuerst Übungen hinzu."
          title="Noch keine Übungen"
        />
      )}

      {session.planId === 'free-training' && currentSessionExercise ? (
        <button onClick={() => setExercisePickerOpen(true)} type="button">Übung hinzufügen</button>
      ) : null}

      <TrainingStickyActionBar
        primaryAction={{ label: 'Training abschließen', onClick: () => setSheetAction('finish') }}
        secondaryAction={{ label: 'Training verwerfen', onClick: () => setSheetAction('discard') }}
      />

      <TrainingBottomSheet
        onClose={() => setExercisePickerOpen(false)}
        open={exercisePickerOpen}
        title="Übung hinzufügen"
      >
        {state.exercises
          .filter(({ id }) => !selectedExerciseIds.has(id))
          .map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => {
                dispatch({ type: 'session/add-exercise', exerciseId: exercise.id })
                setExercisePickerOpen(false)
              }}
              type="button"
            >
              {exercise.name} hinzufügen
            </button>
          ))}
      </TrainingBottomSheet>

      <TrainingBottomSheet
        onClose={() => setGripExerciseId(undefined)}
        open={Boolean(currentSessionExercise && gripExerciseId === currentSessionExercise.id)}
        title="Griff wählen"
      >
        {currentSessionExercise && currentExercise?.gripOptions.map((grip) => (
          <button
            aria-pressed={currentSessionExercise.grip === grip}
            key={grip}
            onClick={() => {
              dispatch({
                type: 'session/update-exercise',
                exerciseId: currentSessionExercise.exerciseId,
                changes: { grip },
              })
              setGripExerciseId(undefined)
            }}
            type="button"
          >
            {grip}
          </button>
        ))}
      </TrainingBottomSheet>

      <FinishDiscardSheet
        action={sheetAction ?? 'finish'}
        onClose={() => setSheetAction(undefined)}
        onConfirm={() => resolveSession(sheetAction ?? 'finish')}
        open={Boolean(sheetAction)}
      />
    </main>
  )
}
