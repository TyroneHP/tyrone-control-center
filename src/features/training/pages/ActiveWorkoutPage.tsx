import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, ResponsiveDialog } from '../../../design-system'
import { ExercisePickerDialog } from '../components/ExercisePickerDialog'
import { WorkoutSetRow } from '../components/WorkoutSetRow'
import type {
  ActiveWorkout,
  ExerciseDefinition,
  LoadMode,
  WorkoutExerciseEntry,
} from '../model/trainingTypes'
import type {
  WorkoutExerciseChanges,
  WorkoutSetChanges,
} from '../model/workoutModel'
import { useTraining } from '../useTraining'

function timestamp() {
  return new Date().toISOString()
}

function loadModeOptions(currentMode: LoadMode) {
  return [
    ...(currentMode === 'external'
      ? [{ label: 'Gewicht', value: 'external' as const }]
      : []),
    { label: 'Eigengewicht', value: 'bodyweight' as const },
    { label: 'Zusatzgewicht', value: 'added' as const },
    { label: 'Unterstützung', value: 'assisted' as const },
  ]
}

interface WorkoutExerciseCardProps {
  catalogExercise: ExerciseDefinition | undefined
  entry: WorkoutExerciseEntry
  index: number
  itemCount: number
  onAddSet: () => void
  onMove: (toIndex: number) => void
  onRemove: () => void
  onRemoveSet: (setId: string) => void
  onUpdate: (changes: WorkoutExerciseChanges) => void
  onUpdateSet: (setId: string, changes: WorkoutSetChanges) => void
  showRating: boolean
}

function WorkoutExerciseCard({
  catalogExercise,
  entry,
  index,
  itemCount,
  onAddSet,
  onMove,
  onRemove,
  onRemoveSet,
  onUpdate,
  onUpdateSet,
  showRating,
}: WorkoutExerciseCardProps) {
  const name = catalogExercise?.name ?? 'Unbekannte Übung'
  const gripOptions = Array.from(
    new Set([
      ...(entry.grip ? [entry.grip] : []),
      ...(catalogExercise?.gripOptions ?? []),
    ]),
  )

  return (
    <li className="active-workout__exercise">
      <Card>
        <header className="active-workout__exercise-header">
          <div>
            <h2>{name}</h2>
            <p>
              Ziel: {entry.targetSets} Sätze mit {entry.repMin}–{entry.repMax}{' '}
              Wiederholungen
            </p>
          </div>
          <div className="active-workout__exercise-actions">
            <button
              aria-label="Übung nach oben"
              className="button--secondary"
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
              type="button"
            >
              Nach oben
            </button>
            <button
              aria-label="Übung nach unten"
              className="button--secondary"
              disabled={index === itemCount - 1}
              onClick={() => onMove(index + 1)}
              type="button"
            >
              Nach unten
            </button>
            <button
              aria-label={`Übung entfernen: ${name}`}
              className="button--danger"
              onClick={onRemove}
              type="button"
            >
              Entfernen
            </button>
          </div>
        </header>

        {catalogExercise?.supportsBodyweightModes ? (
          <label>
            Belastungsmodus
            <select
              aria-label={`Belastungsmodus für ${name}`}
              onChange={(event) =>
                onUpdate({ loadMode: event.target.value as LoadMode })
              }
              value={entry.loadMode}
            >
              {loadModeOptions(entry.loadMode).map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {gripOptions.length > 0 ? (
          <label>
            Griff
            <select
              aria-label={`Griff für ${name}`}
              onChange={(event) =>
                onUpdate({ grip: event.target.value || undefined })
              }
              value={entry.grip ?? ''}
            >
              <option value="">Keine Auswahl</option>
              {gripOptions.map((grip) => (
                <option key={grip} value={grip}>
                  {grip}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Notiz
          <textarea
            aria-label={`Notiz für ${name}`}
            onChange={(event) => onUpdate({ note: event.target.value })}
            value={entry.note}
          />
        </label>

        <ol className="active-workout__sets">
          {entry.sets.map((set, setIndex) => (
            <WorkoutSetRow
              index={setIndex}
              key={set.id}
              loadMode={entry.loadMode}
              onChange={(changes) => onUpdateSet(set.id, changes)}
              onDelete={() => onRemoveSet(set.id)}
              set={set}
              showRating={showRating}
            />
          ))}
        </ol>
        <button
          aria-label={`Satz hinzufügen: ${name}`}
          className="button--secondary"
          onClick={onAddSet}
          type="button"
        >
          Satz hinzufügen
        </button>
      </Card>
    </li>
  )
}

export function ActiveWorkoutPage() {
  const navigate = useNavigate()
  const {
    addWorkoutExercise,
    addWorkoutSet,
    catalog,
    completeWorkout,
    discardWorkout,
    loading,
    removeWorkoutExercise,
    removeWorkoutSet,
    reorderWorkoutExercise,
    state,
    updateWorkoutExercise,
    updateWorkoutSet,
  } = useTraining()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [resolutionPending, setResolutionPending] = useState(false)
  const [resolutionWorkout, setResolutionWorkout] = useState<ActiveWorkout>()
  const workout = state.activeWorkout ?? resolutionWorkout

  if (loading) return <p>Aktives Training wird geladen …</p>

  if (!workout) {
    return (
      <section aria-labelledby="active-workout-heading">
        <h1 id="active-workout-heading">Kein aktives Training</h1>
        <p>Starte ein Training über deine Trainingsübersicht.</p>
        <Link className="button button--primary" to="/training">
          Zur Trainingsübersicht
        </Link>
      </section>
    )
  }

  const orderedExercises = [...workout.exercises].sort(
    (left, right) => left.order - right.order,
  )

  const updateExercise = (
    exerciseEntryId: string,
    changes: WorkoutExerciseChanges,
  ) => updateWorkoutExercise(exerciseEntryId, changes, timestamp())

  const updateSet = (
    exerciseEntryId: string,
    setId: string,
    changes: WorkoutSetChanges,
  ) => updateWorkoutSet(exerciseEntryId, setId, changes, timestamp())

  const addExercise = (exercise: ExerciseDefinition) => {
    addWorkoutExercise({ exerciseId: exercise.id }, timestamp())
  }

  const finish = async () => {
    if (resolutionPending) return
    const workoutId = workout.id
    setResolutionWorkout(workout)
    setResolutionPending(true)
    try {
      const saved = await completeWorkout(timestamp())
      if (!saved) return
      setFinishOpen(false)
      navigate(`/training/history/${workoutId}`)
    } finally {
      setResolutionPending(false)
      setResolutionWorkout(undefined)
    }
  }

  const discard = async () => {
    if (resolutionPending) return
    setResolutionWorkout(workout)
    setResolutionPending(true)
    try {
      const saved = await discardWorkout()
      if (!saved) return
      setDiscardOpen(false)
      navigate('/training')
    } finally {
      setResolutionPending(false)
      setResolutionWorkout(undefined)
    }
  }

  return (
    <section aria-labelledby="active-workout-heading" className="active-workout">
      <header className="active-workout__header">
        <div>
          <p>Aktives Training</p>
          <h1 id="active-workout-heading">{workout.name}</h1>
          <p>
            Gestartet am{' '}
            {new Date(workout.startedAt).toLocaleString('de-DE', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <button
          className="button--primary"
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          Übung hinzufügen
        </button>
      </header>

      {orderedExercises.length > 0 ? (
        <ol className="active-workout__exercise-list">
          {orderedExercises.map((entry, index) => (
            <WorkoutExerciseCard
              catalogExercise={catalog.find(
                ({ id }) => id === entry.exerciseId,
              )}
              entry={entry}
              index={index}
              itemCount={orderedExercises.length}
              key={entry.id}
              onAddSet={() => addWorkoutSet(entry.id, timestamp())}
              onMove={(toIndex) =>
                reorderWorkoutExercise(entry.id, toIndex, timestamp())
              }
              onRemove={() => removeWorkoutExercise(entry.id, timestamp())}
              onRemoveSet={(setId) =>
                removeWorkoutSet(entry.id, setId, timestamp())
              }
              onUpdate={(changes) => updateExercise(entry.id, changes)}
              onUpdateSet={(setId, changes) =>
                updateSet(entry.id, setId, changes)
              }
              showRating={state.preferences.showSetRating}
            />
          ))}
        </ol>
      ) : (
        <p>Noch keine Übungen in diesem Training.</p>
      )}

      <footer className="active-workout__actions">
        <button
          className="button--danger"
          onClick={() => setDiscardOpen(true)}
          type="button"
        >
          Training verwerfen
        </button>
        <button
          className="button--primary"
          onClick={() => setFinishOpen(true)}
          type="button"
        >
          Training abschließen
        </button>
      </footer>

      <ExercisePickerDialog
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        open={pickerOpen}
      />

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              disabled={resolutionPending}
              onClick={() => setFinishOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--primary"
              disabled={resolutionPending}
              onClick={() => void finish()}
              type="button"
            >
              Training abschließen
            </button>
          </>
        }
        dismissible={!resolutionPending}
        onClose={() => {
          if (!resolutionPending) setFinishOpen(false)
        }}
        open={finishOpen}
        title="Training abschließen?"
      >
        <p>Das Training wird im Trainingsverlauf gespeichert.</p>
      </ResponsiveDialog>

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              disabled={resolutionPending}
              onClick={() => setDiscardOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              disabled={resolutionPending}
              onClick={() => void discard()}
              type="button"
            >
              Endgültig verwerfen
            </button>
          </>
        }
        dismissible={!resolutionPending}
        onClose={() => {
          if (!resolutionPending) setDiscardOpen(false)
        }}
        open={discardOpen}
        title="Training wirklich verwerfen?"
      >
        <p>Alle Eingaben dieses aktiven Trainings gehen verloren.</p>
      </ResponsiveDialog>
    </section>
  )
}
