import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Card,
  InlineAlert,
  ResponsiveDialog,
} from '../../../design-system'
import { WorkoutSetRow } from '../components/WorkoutSetRow'
import { getProgressionRecommendation } from '../model/progression'
import { completedWorkoutSchema } from '../model/trainingSchemas'
import type {
  CompletedWorkout,
  ExerciseDefinition,
  LoadMode,
  TrainingState,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import { useTraining } from '../useTraining'

const dateTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
})

function cloneWorkout(workout: CompletedWorkout): CompletedWorkout {
  return structuredClone(workout)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function loadModeLabel(loadMode: LoadMode) {
  switch (loadMode) {
    case 'bodyweight':
      return 'Eigengewicht'
    case 'added':
      return 'Zusatzgewicht'
    case 'assisted':
      return 'Unterstützung'
    default:
      return 'Externes Gewicht'
  }
}

function setWeight(set: WorkoutSetEntry, loadMode: LoadMode) {
  if (loadMode === 'bodyweight') return 'Eigengewicht'
  return set.weightKg === null ? '–' : `${formatNumber(set.weightKg)} kg`
}

function latestLoadMode(exerciseId: string, state: TrainingState) {
  return state.completedWorkouts
    .flatMap((workout) =>
      workout.exercises
        .filter((entry) => entry.exerciseId === exerciseId)
        .map((entry) => ({ completedAt: workout.completedAt, entry })),
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    )[0]?.entry.loadMode
}

function RecommendationCard({
  exercise,
  state,
}: {
  exercise: WorkoutExerciseEntry
  state: TrainingState
}) {
  const recommendation = getProgressionRecommendation(
    exercise.exerciseId,
    state.completedWorkouts,
    state.preferences,
  )
  if (!recommendation) return null

  const message =
    latestLoadMode(exercise.exerciseId, state) === 'assisted'
      ? `Weniger Unterstützung ausprobieren: ${formatNumber(
          recommendation.suggestedWeightKg,
        )} kg`
      : `Du hast ${formatNumber(
          recommendation.currentWeightKg,
        )} kg im Zielbereich wiederholt erreicht. Vorschlag für das nächste Training: ${formatNumber(
          recommendation.suggestedWeightKg,
        )} kg.`

  return (
    <Card className="training-recommendation">
      <h3>Steigerung möglich</h3>
      <p>{message}</p>
    </Card>
  )
}

function WorkoutExerciseDetails({
  catalog,
  entry,
  showRating,
  state,
}: {
  catalog: readonly ExerciseDefinition[]
  entry: WorkoutExerciseEntry
  showRating: boolean
  state: TrainingState
}) {
  const titleId = useId()
  const catalogExercise = catalog.find(({ id }) => id === entry.exerciseId)
  const name = catalogExercise?.name ?? 'Unbekannte Übung'
  const measurementLabel =
    catalogExercise?.unit === 'seconds' ? 'Sekunden' : 'Wiederholungen'
  const showWeight =
    entry.loadMode === 'added' ||
    entry.loadMode === 'assisted' ||
    (entry.loadMode === 'external' &&
      (catalogExercise?.unit ?? 'kg-reps') === 'kg-reps')
  const showLoad = showWeight || Boolean(catalogExercise?.supportsBodyweightModes)

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <h2 id={titleId}>{name}</h2>
        <p>
          Ziel: {entry.targetSets} Sätze mit {entry.repMin}–{entry.repMax}{' '}
          {measurementLabel}
        </p>
        {showLoad ? <p>Belastung: {loadModeLabel(entry.loadMode)}</p> : null}
        <p>Griff: {entry.grip ?? 'Keine Angabe'}</p>
        <p>Notiz: {entry.note || 'Keine Notiz'}</p>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption>Sätze für {name}</caption>
            <thead>
              <tr>
                <th scope="col">Satz</th>
                {showWeight ? <th scope="col">Gewicht</th> : null}
                <th scope="col">{measurementLabel}</th>
                {showRating ? <th scope="col">Bewertung</th> : null}
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {entry.sets.map((set, index) => (
                <tr key={set.id}>
                  <th scope="row">{index + 1}</th>
                  {showWeight ? <td>{setWeight(set, entry.loadMode)}</td> : null}
                  <td>{set.reps ?? '–'}</td>
                  {showRating ? <td>{set.rating ?? '–'}</td> : null}
                  <td>{set.completed ? 'Abgeschlossen' : 'Offen'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RecommendationCard exercise={entry} state={state} />
      </Card>
    </section>
  )
}

function numberInput(value: string) {
  return value === '' ? 0 : Number(value)
}

function WorkoutExerciseEditor({
  catalogExercise,
  disabled,
  entry,
  onChange,
  showRating,
}: {
  catalogExercise: ExerciseDefinition | undefined
  disabled: boolean
  entry: WorkoutExerciseEntry
  onChange: (entry: WorkoutExerciseEntry) => void
  showRating: boolean
}) {
  const name = catalogExercise?.name ?? 'Unbekannte Übung'
  const measurementLabel =
    catalogExercise?.unit === 'seconds' ? 'Sekunden' : 'Wiederholungen'
  const updateSet = (setId: string, changes: Partial<WorkoutSetEntry>) => {
    onChange({
      ...entry,
      sets: entry.sets.map((set) =>
        set.id === setId ? { ...set, ...changes } : set,
      ),
    })
  }

  return (
    <fieldset disabled={disabled}>
      <legend>{name} bearbeiten</legend>
      <div>
        <label>
          Zielsätze
          <input
            aria-label={`Zielsätze für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onChange({ ...entry, targetSets: numberInput(event.target.value) })
            }
            step="1"
            type="number"
            value={entry.targetSets}
          />
        </label>
        <label>
          Minimale {measurementLabel}
          <input
            aria-label={`Minimale ${measurementLabel} für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onChange({ ...entry, repMin: numberInput(event.target.value) })
            }
            step="1"
            type="number"
            value={entry.repMin}
          />
        </label>
        <label>
          Maximale {measurementLabel}
          <input
            aria-label={`Maximale ${measurementLabel} für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onChange({ ...entry, repMax: numberInput(event.target.value) })
            }
            step="1"
            type="number"
            value={entry.repMax}
          />
        </label>
      </div>

      {catalogExercise?.supportsBodyweightModes ? (
        <label>
          Belastungsmodus
          <select
            aria-label={`Belastungsmodus für ${name}`}
            onChange={(event) =>
              onChange({ ...entry, loadMode: event.target.value as LoadMode })
            }
            value={entry.loadMode}
          >
            <option value="bodyweight">Eigengewicht</option>
            <option value="added">Zusatzgewicht</option>
            <option value="assisted">Unterstützung</option>
          </select>
        </label>
      ) : null}

      <label>
        Griff
        <input
          aria-label={`Griff für ${name}`}
          onChange={(event) =>
            onChange({
              ...entry,
              ...(event.target.value
                ? { grip: event.target.value }
                : { grip: undefined }),
            })
          }
          type="text"
          value={entry.grip ?? ''}
        />
      </label>
      <label>
        Notiz
        <textarea
          aria-label={`Notiz für ${name}`}
          onChange={(event) => onChange({ ...entry, note: event.target.value })}
          value={entry.note}
        />
      </label>

      <ol>
        {entry.sets.map((set, index) => (
          <WorkoutSetRow
            index={index}
            key={set.id}
            loadMode={entry.loadMode}
            onChange={(changes) => updateSet(set.id, changes)}
            onDelete={() =>
              onChange({
                ...entry,
                sets: entry.sets.filter(({ id }) => id !== set.id),
              })
            }
            set={set}
            showRating={showRating}
            unit={catalogExercise?.unit ?? 'kg-reps'}
          />
        ))}
      </ol>
    </fieldset>
  )
}

export function CompletedWorkoutPage() {
  const navigate = useNavigate()
  const { workoutId } = useParams()
  const {
    catalog,
    deleteCompletedWorkout,
    loading,
    replaceCompletedWorkout,
    state,
  } = useTraining()
  const workout = state.completedWorkouts.find(({ id }) => id === workoutId)
  const [draft, setDraft] = useState<CompletedWorkout>()
  const [editing, setEditing] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [validationError, setValidationError] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deletionSnapshot, setDeletionSnapshot] = useState<CompletedWorkout>()
  const displayedWorkout = workout ?? (deletePending ? deletionSnapshot : undefined)

  if (loading) return <p>Training wird geladen …</p>

  if (!displayedWorkout) {
    return (
      <section aria-labelledby="completed-workout-heading">
        <h1 id="completed-workout-heading">Abgeschlossenes Training</h1>
        <h2>Training nicht gefunden</h2>
        <p>Dieses abgeschlossene Training ist nicht mehr vorhanden.</p>
        <Link to="/training/history">Zum Trainingsverlauf</Link>
      </section>
    )
  }

  const beginEdit = () => {
    setDraft(cloneWorkout(displayedWorkout))
    setValidationError(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    if (savePending) return
    setDraft(undefined)
    setValidationError(false)
    setEditing(false)
  }

  const updateDraftExercise = (replacement: WorkoutExerciseEntry) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((entry) =>
              entry.id === replacement.id ? replacement : entry,
            ),
          }
        : current,
    )
  }

  const saveDraft = async () => {
    if (!draft || savePending) return
    const result = completedWorkoutSchema.safeParse(draft)
    if (!result.success) {
      setValidationError(true)
      return
    }

    setValidationError(false)
    setSavePending(true)
    const saved = await replaceCompletedWorkout(
      displayedWorkout.id,
      result.data,
    )
    setSavePending(false)
    if (!saved) return
    setDraft(undefined)
    setEditing(false)
  }

  const confirmDelete = async () => {
    if (deletePending) return
    setDeleteError(false)
    setDeletionSnapshot(displayedWorkout)
    setDeletePending(true)
    const deleted = await deleteCompletedWorkout(displayedWorkout.id)
    setDeletePending(false)
    if (!deleted) {
      setDeleteError(true)
      return
    }
    setDeleteOpen(false)
    navigate('/training/history')
  }

  return (
    <section aria-labelledby="completed-workout-heading">
      <header>
        <div>
          <p>Abgeschlossenes Training</p>
          <h1 id="completed-workout-heading">
            {editing && draft ? draft.name : displayedWorkout.name}
          </h1>
          <p>
            <time dateTime={displayedWorkout.completedAt}>
              {formatDateTime(displayedWorkout.completedAt)}
            </time>
          </p>
        </div>
        <Link className="button button--secondary" to="/training/history">
          Zum Trainingsverlauf
        </Link>
      </header>

      {editing && draft ? (
        <div>
          <label>
            Trainingsname
            <input
              aria-label="Trainingsname"
              disabled={savePending}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              type="text"
              value={draft.name}
            />
          </label>
          {draft.exercises.map((entry) => (
            <WorkoutExerciseEditor
              catalogExercise={catalog.find(({ id }) => id === entry.exerciseId)}
              disabled={savePending}
              entry={entry}
              key={entry.id}
              onChange={updateDraftExercise}
              showRating={state.preferences.showSetRating}
            />
          ))}
          {validationError ? (
            <InlineAlert variant="error">
              Bitte prüfe die markierten Trainingswerte.
            </InlineAlert>
          ) : null}
          <div>
            <button
              className="button--secondary"
              disabled={savePending}
              onClick={cancelEdit}
              type="button"
            >
              Bearbeitung abbrechen
            </button>
            <button
              className="button--primary"
              disabled={savePending}
              onClick={() => void saveDraft()}
              type="button"
            >
              {savePending ? 'Wird gespeichert …' : 'Änderungen speichern'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <button className="button--secondary" onClick={beginEdit} type="button">
              Training bearbeiten
            </button>
            <button
              className="button--danger"
              onClick={() => {
                setDeleteError(false)
                setDeleteOpen(true)
              }}
              type="button"
            >
              Training löschen
            </button>
          </div>
          <div>
            {[...displayedWorkout.exercises]
              .sort((left, right) => left.order - right.order)
              .map((entry) => (
                <WorkoutExerciseDetails
                  catalog={catalog}
                  entry={entry}
                  key={entry.id}
                  showRating={state.preferences.showSetRating}
                  state={state}
                />
              ))}
          </div>
        </>
      )}

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              disabled={deletePending}
              onClick={() => void confirmDelete()}
              type="button"
            >
              {deletePending ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </button>
          </>
        }
        dismissible={!deletePending}
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        title="Training wirklich löschen?"
      >
        <p>Das vollständige Training wird dauerhaft von diesem Gerät gelöscht.</p>
        {deleteError ? (
          <InlineAlert variant="error">
            Training konnte nicht gelöscht werden.
          </InlineAlert>
        ) : null}
      </ResponsiveDialog>
    </section>
  )
}
