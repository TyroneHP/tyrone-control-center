import { useState } from 'react'
import type { TrainingPreferences } from './model/trainingTypes'
import { useTraining } from './useTraining'

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function halfKilogram(value: number) {
  return Math.max(0.5, Math.round(value * 2) / 2)
}

function inputNumber(value: string) {
  if (value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function TrainingSettingsForm({
  preferences,
  updatePreferences,
}: {
  preferences: TrainingPreferences
  updatePreferences: (changes: Partial<TrainingPreferences>) => void
}) {
  const [successfulWorkoutCount, setSuccessfulWorkoutCount] = useState(
    String(preferences.successfulWorkoutCount),
  )
  const [maximumAverageRating, setMaximumAverageRating] = useState(
    String(preferences.maximumAverageRating),
  )
  const [defaultIncrementKg, setDefaultIncrementKg] = useState(
    String(preferences.defaultIncrementKg),
  )

  return (
    <div className="settings-card training-settings">
      <div className="settings-card__heading">
        <div>
          <h2>Training</h2>
          <p>Lege fest, wie dein Training ausgewertet und gesteigert wird.</p>
        </div>
      </div>

      <label className="training-settings__toggle">
        <input
          aria-label="Satzbewertungen anzeigen"
          checked={preferences.showSetRating}
          onChange={(event) =>
            updatePreferences({ showSetRating: event.target.checked })
          }
          type="checkbox"
        />
        <span>
          <strong>Satzbewertungen anzeigen</strong>
          <small>Bewerte abgeschlossene Sätze auf einer Skala von 1 bis 10.</small>
        </span>
      </label>

      <label className="training-settings__toggle">
        <input
          aria-label="Progressive Steigerung aktivieren"
          checked={preferences.progressionEnabled}
          onChange={(event) =>
            updatePreferences({ progressionEnabled: event.target.checked })
          }
          type="checkbox"
        />
        <span>
          <strong>Progressive Steigerung aktivieren</strong>
          <small>Erhalte Vorschläge, wenn du dein Ziel wiederholt erreichst.</small>
        </span>
      </label>

      <fieldset disabled={!preferences.progressionEnabled}>
        <legend>Regeln für die Steigerung</legend>
        <div className="training-settings__progression-fields">
          <label>
            Erfolgreiche Trainings
            <input
              aria-label="Erfolgreiche Trainings"
              inputMode="numeric"
              max="5"
              min="2"
              onChange={(event) => {
                const input = event.target.value
                setSuccessfulWorkoutCount(input)
                const value = inputNumber(input)
                if (value !== undefined) {
                  updatePreferences({
                    successfulWorkoutCount: clampInteger(value, 2, 5),
                  })
                }
              }}
              onBlur={() => {
                const value = inputNumber(successfulWorkoutCount)
                if (value !== undefined) {
                  setSuccessfulWorkoutCount(String(clampInteger(value, 2, 5)))
                }
              }}
              step="1"
              type="number"
              value={successfulWorkoutCount}
            />
          </label>
          <label>
            Maximale Durchschnittsbewertung
            <input
              aria-label="Maximale Durchschnittsbewertung"
              inputMode="numeric"
              max="10"
              min="1"
              onChange={(event) => {
                const input = event.target.value
                setMaximumAverageRating(input)
                const value = inputNumber(input)
                if (value !== undefined) {
                  updatePreferences({
                    maximumAverageRating: clampInteger(value, 1, 10),
                  })
                }
              }}
              onBlur={() => {
                const value = inputNumber(maximumAverageRating)
                if (value !== undefined) {
                  setMaximumAverageRating(String(clampInteger(value, 1, 10)))
                }
              }}
              step="1"
              type="number"
              value={maximumAverageRating}
            />
          </label>
          <label>
            Standardsteigerung in kg
            <input
              aria-label="Standardsteigerung in kg"
              inputMode="decimal"
              min="0.5"
              onChange={(event) => {
                const input = event.target.value
                setDefaultIncrementKg(input)
                const value = inputNumber(input)
                if (value !== undefined) {
                  updatePreferences({ defaultIncrementKg: halfKilogram(value) })
                }
              }}
              onBlur={() => {
                const value = inputNumber(defaultIncrementKg)
                if (value !== undefined) {
                  setDefaultIncrementKg(String(halfKilogram(value)))
                }
              }}
              step="0.5"
              type="number"
              value={defaultIncrementKg}
            />
          </label>
        </div>
      </fieldset>
    </div>
  )
}

export function TrainingSettings() {
  const { loading, state, updatePreferences } = useTraining()
  const { preferences } = state

  return (
    <TrainingSettingsForm
      key={loading ? 'loading' : 'loaded'}
      preferences={preferences}
      updatePreferences={updatePreferences}
    />
  )
}
