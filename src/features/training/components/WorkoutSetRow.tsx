import type {
  ExerciseUnit,
  LoadMode,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import type { WorkoutSetChanges } from '../model/workoutModel'

export interface WorkoutSetRowProps {
  index: number
  loadMode: LoadMode
  onChange: (changes: WorkoutSetChanges) => void
  onDelete: () => void
  set: WorkoutSetEntry
  showRating: boolean
  unit: ExerciseUnit
  validationErrorId?: string
  validationErrors?: Partial<
    Record<'rating' | 'reps' | 'weightKg', boolean>
  >
}

function optionalNumber(value: string, integer: boolean) {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    return undefined
  }
  return parsed
}

function weightLabel(loadMode: LoadMode) {
  if (loadMode === 'added') return 'Zusatzgewicht'
  if (loadMode === 'assisted') return 'Unterstützung'
  return 'Gewicht'
}

export function WorkoutSetRow({
  index,
  loadMode,
  onChange,
  onDelete,
  set,
  showRating,
  unit,
  validationErrorId,
  validationErrors,
}: WorkoutSetRowProps) {
  const setNumber = index + 1
  const showWeight =
    loadMode === 'added' ||
    loadMode === 'assisted' ||
    (loadMode === 'external' && unit === 'kg-reps')
  const repetitionsLabel = unit === 'seconds' ? 'Sekunden' : 'Wiederholungen'

  return (
    <li className="workout-set-row">
      <p className="workout-set-row__number">Satz {setNumber}</p>
      {showWeight ? (
        <label>
          {weightLabel(loadMode)}
          <input
            aria-describedby={
              validationErrors?.weightKg ? validationErrorId : undefined
            }
            aria-invalid={validationErrors?.weightKg || undefined}
            aria-label={`Satz ${setNumber} Gewicht`}
            inputMode="decimal"
            min="0"
            onChange={(event) => {
              const weightKg = optionalNumber(event.target.value, false)
              if (weightKg !== undefined) onChange({ weightKg })
            }}
            step="any"
            type="number"
            value={set.weightKg ?? ''}
          />
        </label>
      ) : null}
      <label>
        {repetitionsLabel}
        <input
          aria-describedby={
            validationErrors?.reps ? validationErrorId : undefined
          }
          aria-invalid={validationErrors?.reps || undefined}
          aria-label={`Satz ${setNumber} ${repetitionsLabel}`}
          inputMode="numeric"
          min="0"
          onChange={(event) => {
            const reps = optionalNumber(event.target.value, true)
            if (reps !== undefined) onChange({ reps })
          }}
          step="1"
          type="number"
          value={set.reps ?? ''}
        />
      </label>
      {showRating ? (
        <label>
          Bewertung
          <select
            aria-describedby={
              validationErrors?.rating ? validationErrorId : undefined
            }
            aria-invalid={validationErrors?.rating || undefined}
            aria-label={`Satz ${setNumber} Bewertung`}
            onChange={(event) => {
              const rating = optionalNumber(event.target.value, true)
              if (rating !== undefined) onChange({ rating })
            }}
            value={set.rating ?? ''}
          >
            <option value="">Keine</option>
            {Array.from({ length: 10 }, (_, rating) => rating + 1).map(
              (rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}
      <label className="workout-set-row__completed">
        Abgeschlossen
        <input
          aria-label={`Satz ${setNumber} abgeschlossen`}
          checked={set.completed}
          onChange={(event) => onChange({ completed: event.target.checked })}
          type="checkbox"
        />
      </label>
      <button
        aria-label={`Satz ${setNumber} löschen`}
        className="button--ghost"
        onClick={onDelete}
        type="button"
      >
        Satz löschen
      </button>
    </li>
  )
}
