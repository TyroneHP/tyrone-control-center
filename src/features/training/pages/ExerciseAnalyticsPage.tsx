import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, ResponsiveDialog } from '../../../design-system'
import {
  getExerciseSeries,
  type ExerciseDataPoint,
} from '../analytics/exerciseAnalytics'
import {
  resolveAnalyticsRange,
  toLocalDateKey,
} from '../analytics/dateRangeAnalytics'
import { AnalyticsPeriodFilter } from '../components/AnalyticsPeriodFilter'
import { LineChart } from '../components/LineChart'
import type {
  ExerciseDefinition,
  ExerciseMetric,
  ExerciseSnapshot,
} from '../model/trainingTypes'
import { useTraining } from '../useTraining'

const METRICS: Record<ExerciseMetric, { chartLabel: string; label: string; unit: string }> = {
  weight: { chartLabel: 'Gewichtsverlauf', label: 'Gewicht', unit: 'kg' },
  reps: { chartLabel: 'Wiederholungsverlauf', label: 'Wiederholungen', unit: 'Wdh.' },
  volume: { chartLabel: 'Volumenverlauf', label: 'Volumen', unit: 'kg' },
  oneRepMax: { chartLabel: '1RM-Verlauf', label: 'Geschätztes 1RM', unit: 'kg' },
}
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

function historicalExercise(snapshot: ExerciseSnapshot): ExerciseDefinition {
  return {
    id: snapshot.exerciseId, source: 'custom', name: snapshot.name,
    primaryMuscles: [...snapshot.primaryMuscles],
    secondaryMuscles: [...snapshot.secondaryMuscles], equipment: [],
    unit: snapshot.unit, description: 'Historische Übung aus deinem Verlauf.',
    gripOptions: [], supportsBodyweightModes: snapshot.supportsBodyweightModes,
  }
}

function getAnalysisExercises(
  catalog: readonly ExerciseDefinition[],
  completedWorkouts: ReturnType<typeof useTraining>['state']['completedWorkouts'],
) {
  const exercises = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  for (const workout of completedWorkouts) {
    for (const entry of workout.exercises) {
      const current = exercises.get(entry.exerciseId)
      if (!current) exercises.set(entry.exerciseId, historicalExercise(entry.exerciseSnapshot))
    }
  }
  return [...exercises.values()]
}

function availableMetrics(exercise?: ExerciseDefinition): ExerciseMetric[] {
  if (!exercise) return []
  return exercise.unit === 'kg-reps' || exercise.supportsBodyweightModes
    ? ['weight', 'reps', 'volume', 'oneRepMax']
    : ['reps']
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00.000Z`))
}

export function ExerciseAnalyticsPage() {
  const { catalog, loading, state, updateAnalyticsPreferences } = useTraining()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [primaryMuscle, setPrimaryMuscle] = useState('')
  const [favoritesFirst, setFavoritesFirst] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<ExerciseDataPoint>()
  const [metricChoice, setMetricChoice] = useState(
    state.analyticsPreferences.exerciseMetric,
  )
  const exercises = useMemo(
    () => getAnalysisExercises(catalog, state.completedWorkouts),
    [catalog, state.completedWorkouts],
  )
  const muscles = useMemo(
    () => [...new Set(exercises.flatMap(({ primaryMuscles }) => primaryMuscles))]
      .sort((left, right) => left.localeCompare(right, 'de')),
    [exercises],
  )
  const visibleExercises = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de')
    return exercises
      .filter((exercise) =>
        (!normalized || exercise.name.toLocaleLowerCase('de').includes(normalized)) &&
        (!primaryMuscle || exercise.primaryMuscles.includes(primaryMuscle)),
      )
      .sort((left, right) => {
        if (favoritesFirst) {
          const favoriteDifference =
            Number(state.favoriteExerciseIds.includes(right.id)) -
            Number(state.favoriteExerciseIds.includes(left.id))
          if (favoriteDifference) return favoriteDifference
        }
        return left.name.localeCompare(right.name, 'de')
      })
  }, [exercises, favoritesFirst, primaryMuscle, query, state.favoriteExerciseIds])
  const requestedId = searchParams.get('exercise')
  const selectedExercise =
    exercises.find(({ id }) => id === requestedId) ?? visibleExercises[0]
  const supportedMetrics = availableMetrics(selectedExercise)
  const metric = supportedMetrics.includes(metricChoice)
    ? metricChoice
    : supportedMetrics[0]
  const availableDates = state.completedWorkouts.flatMap(({ completedAt }) => {
    try { return [toLocalDateKey(completedAt)] } catch { return [] }
  })
  const rangeResult = resolveAnalyticsRange(
    state.analyticsPreferences.range,
    new Date(),
    availableDates,
  )
  const series = selectedExercise && metric && rangeResult.valid
    ? getExerciseSeries(
        state.completedWorkouts,
        selectedExercise.id,
        metric,
        rangeResult.range,
      )
    : []

  if (loading) return <p>Übungsfortschritt wird geladen …</p>

  return (
    <section aria-labelledby="exercise-progress-heading" className="training-analytics-page">
      <header>
        <h1 id="exercise-progress-heading">Übungsfortschritt</h1>
        <p>Vergleiche abgeschlossene Sätze aus deinem lokalen Verlauf.</p>
      </header>
      <AnalyticsPeriodFilter
        onChange={(range) => updateAnalyticsPreferences({ range })}
        value={state.analyticsPreferences.range}
      />
      <div className="exercise-analysis-layout">
        <aside aria-label="Übungsauswahl" className="exercise-analysis-picker">
          <label>
            Übung suchen
            <input onChange={(event) => setQuery(event.target.value)} type="search" value={query} />
          </label>
          <label>
            Hauptmuskel
            <select onChange={(event) => setPrimaryMuscle(event.target.value)} value={primaryMuscle}>
              <option value="">Alle Hauptmuskeln</option>
              {muscles.map((muscle) => <option key={muscle}>{muscle}</option>)}
            </select>
          </label>
          <label>
            <input
              checked={favoritesFirst}
              onChange={(event) => setFavoritesFirst(event.target.checked)}
              type="checkbox"
            />
            Favoriten zuerst
          </label>
          {visibleExercises.length ? (
            <ul>
              {visibleExercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    aria-pressed={exercise.id === selectedExercise?.id}
                    onClick={() => setSearchParams({ exercise: exercise.id })}
                    type="button"
                  >
                    {exercise.name} analysieren
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>Keine Übungen gefunden.</p>}
        </aside>

        <Card className="exercise-analysis-main">
          {selectedExercise && metric ? (
            <>
              <h2>{selectedExercise.name}</h2>
              <p>{selectedExercise.primaryMuscles.join(', ')}</p>
              <label>
                Kennzahl
                <select
                  onChange={(event) => {
                    const exerciseMetric = event.target.value as ExerciseMetric
                    setMetricChoice(exerciseMetric)
                    updateAnalyticsPreferences({ exerciseMetric })
                  }}
                  value={metric}
                >
                  {supportedMetrics.map((option) => (
                    <option key={option} value={option}>{METRICS[option].label}</option>
                  ))}
                </select>
              </label>
              {series.length ? (
                <LineChart
                  ariaLabel={`${METRICS[metric].chartLabel} ${selectedExercise.name}`}
                  data={series.map((point) => ({
                    id: `${point.workoutId}:${metric}`,
                    label: formatDate(point.date),
                    value: point.value,
                    description: point.workoutName,
                  }))}
                  onSelect={(chartPoint) => setSelectedPoint(
                    series.find((point) => `${point.workoutId}:${metric}` === chartPoint.id),
                  )}
                  unit={METRICS[metric].unit}
                />
              ) : <p>Noch keine passenden Trainingsdaten vorhanden.</p>}
            </>
          ) : <p>Wähle eine Übung aus, um ihren Verlauf zu sehen.</p>}
        </Card>
      </div>

      <ResponsiveDialog
        actions={<button className="button--secondary" onClick={() => setSelectedPoint(undefined)} type="button">Schließen</button>}
        onClose={() => setSelectedPoint(undefined)}
        open={selectedPoint !== undefined}
        title={selectedPoint?.workoutName ?? 'Trainingspunkt'}
      >
        {selectedPoint ? (
          <div className="exercise-point-details">
            <p>{formatDate(selectedPoint.date)}</p>
            {selectedPoint.grips.length ? <p>Griff: {selectedPoint.grips.join(', ')}</p> : null}
            <ul>
              {selectedPoint.sets.map((set) => (
                <li key={set.setId}>
                  <strong>Satz {set.setNumber}</strong>{' '}
                  <span>{set.weightKg ?? '–'} kg</span>{' · '}
                  <span>{set.reps ?? '–'} Wiederholungen</span>
                  {set.rating === null ? null : <> · <span>Bewertung {set.rating}</span></>}
                </li>
              ))}
            </ul>
            <Link to={`/training/history/${selectedPoint.workoutId}`}>Training im Verlauf öffnen</Link>
          </div>
        ) : null}
      </ResponsiveDialog>
    </section>
  )
}
