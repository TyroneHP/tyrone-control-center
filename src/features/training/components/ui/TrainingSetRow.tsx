export interface TrainingSetValue {
  completed: boolean
  rating?: number | null
  reps?: number | null
  weight?: number | null
}

export interface TrainingSetRowProps {
  onChange: (changes: Partial<TrainingSetValue>) => void
  onDelete?: () => void
  setNumber: number
  showRating?: boolean
  value: TrainingSetValue
}

function decimalValue(value: number | null | undefined) {
  return value ?? ''
}

function readNumber(value: string) {
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export function TrainingSetRow({
  onChange,
  onDelete,
  setNumber,
  showRating = false,
  value,
}: TrainingSetRowProps) {
  const updateNumber = (
    field: 'rating' | 'reps' | 'weight',
    input: string,
    integer = false,
  ) => {
    const nextValue = readNumber(input)
    if (nextValue === undefined || (integer && nextValue !== null && !Number.isInteger(nextValue))) {
      return
    }
    onChange({ [field]: nextValue })
  }

  return (
    <li className="training-set-row">
      <p className="training-set-row__number">Satz {setNumber}</p>
      <label className="training-set-row__field">
        <span>Gewicht</span>
        <input
          aria-label={`Satz ${setNumber} Gewicht`}
          inputMode="decimal"
          min="0"
          onChange={(event) => updateNumber('weight', event.target.value)}
          step="any"
          type="number"
          value={decimalValue(value.weight)}
        />
      </label>
      <label className="training-set-row__field">
        <span>Wiederholungen</span>
        <input
          aria-label={`Satz ${setNumber} Wiederholungen`}
          inputMode="numeric"
          min="0"
          onChange={(event) => updateNumber('reps', event.target.value, true)}
          step="1"
          type="number"
          value={decimalValue(value.reps)}
        />
      </label>
      {showRating ? (
        <label className="training-set-row__field">
          <span>Bewertung</span>
          <input
            aria-label={`Satz ${setNumber} Bewertung`}
            inputMode="numeric"
            max="10"
            min="1"
            onChange={(event) => updateNumber('rating', event.target.value, true)}
            step="1"
            type="number"
            value={decimalValue(value.rating)}
          />
        </label>
      ) : null}
      <button
        aria-label={`Satz ${setNumber} abgeschlossen`}
        aria-pressed={value.completed}
        className="training-set-row__completion"
        onClick={() => onChange({ completed: !value.completed })}
        type="button"
      >
        {value.completed ? 'Abgeschlossen' : 'Offen'}
      </button>
      {onDelete ? (
        <button
          aria-label={`Satz ${setNumber} löschen`}
          className="training-set-row__delete"
          onClick={onDelete}
          type="button"
        >
          Entfernen
        </button>
      ) : null}
    </li>
  )
}
