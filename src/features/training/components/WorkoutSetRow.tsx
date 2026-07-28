import type {
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
}

function optionalNumber(value: string) {
  return value === '' ? null : Number(value)
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
}: WorkoutSetRowProps) {
  const setNumber = index + 1
  const showWeight = loadMode !== 'bodyweight'

  return (
    <li className="workout-set-row">
      <p className="workout-set-row__number">Satz {setNumber}</p>
      {showWeight ? (
        <label>
          {weightLabel(loadMode)}
          <input
            aria-label={`Satz ${setNumber} Gewicht`}
            inputMode="decimal"
            min="0"
            onChange={(event) =>
              onChange({ weightKg: optionalNumber(event.target.value) })
            }
            step="any"
            type="number"
            value={set.weightKg ?? ''}
          />
        </label>
      ) : null}
      <label>
        Wiederholungen
        <input
          aria-label={`Satz ${setNumber} Wiederholungen`}
          inputMode="numeric"
          min="0"
          onChange={(event) =>
            onChange({ reps: optionalNumber(event.target.value) })
          }
          step="1"
          type="number"
          value={set.reps ?? ''}
        />
      </label>
      {showRating ? (
        <label>
          Bewertung
          <select
            aria-label={`Satz ${setNumber} Bewertung`}
            onChange={(event) =>
              onChange({ rating: optionalNumber(event.target.value) })
            }
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
