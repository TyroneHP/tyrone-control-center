import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getExerciseSeries } from '../analytics/exerciseAnalytics'
import { getExerciseRecords } from '../analytics/recordAnalytics'
import { toLocalDateKey } from '../analytics/dateRangeAnalytics'
import { LineChart } from './LineChart'
import type { CompletedWorkout, ExerciseDefinition } from '../model/trainingTypes'

export interface ExerciseProgressSummaryProps {
  exercise: ExerciseDefinition
  workouts: readonly CompletedWorkout[]
}

const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function analyticsRange(workouts: readonly CompletedWorkout[]) {
  const dates = workouts.flatMap(({ completedAt }) => {
    try {
      return [toLocalDateKey(completedAt)]
    } catch {
      return []
    }
  }).sort()
  return {
    startDate: dates[0] ?? '1970-01-01',
    endDate: dates.at(-1) ?? '1970-01-01',
  }
}

export function ExerciseProgressSummary({
  exercise,
  workouts,
}: ExerciseProgressSummaryProps) {
  const supportsLoad =
    exercise.unit === 'kg-reps' || exercise.supportsBodyweightModes
  const data = useMemo(() => {
    const records = getExerciseRecords(workouts).filter(
      ({ exerciseId }) => exerciseId === exercise.id,
    )
    const series = supportsLoad
      ? getExerciseSeries(workouts, exercise.id, 'weight', analyticsRange(workouts))
      : []
    return { records, series }
  }, [exercise.id, supportsLoad, workouts])
  const record = (type: 'weight' | 'setVolume' | 'reps') =>
    data.records.find(({ recordType }) => recordType === type)
  const first = data.series[0]?.value
  const last = data.series.at(-1)?.value

  if (data.records.length === 0 && data.series.length === 0) {
    return <p>Noch keine Fortschrittsdaten vorhanden.</p>
  }

  return (
    <section aria-labelledby={`exercise-progress-${exercise.id}`} className="exercise-progress-summary">
      <h3 id={`exercise-progress-${exercise.id}`}>Fortschritt</h3>
      <dl>
        {supportsLoad ? (
          <>
            <div><dt>Gewichtsrekord</dt><dd>{record('weight') ? `${numberFormatter.format(record('weight')!.value)} kg` : '–'}</dd></div>
            <div><dt>Satzvolumen-Rekord</dt><dd>{record('setVolume') ? `${numberFormatter.format(record('setVolume')!.value)} kg` : '–'}</dd></div>
          </>
        ) : null}
        <div><dt>Wiederholungsrekord</dt><dd>{record('reps')?.value ?? '–'}</dd></div>
      </dl>
      {first !== undefined && last !== undefined ? (
        <p>Trend seit dem ersten Wert: {last >= first ? '+' : ''}{numberFormatter.format(last - first)} kg</p>
      ) : null}
      {data.series.length ? (
        <LineChart
          ariaLabel={`Kompakter Gewichtsverlauf ${exercise.name}`}
          data={data.series.map((point) => ({
            id: point.workoutId, label: point.date, value: point.value,
          }))}
          unit="kg"
        />
      ) : null}
      <Link to={`/training/progress/exercises?exercise=${encodeURIComponent(exercise.id)}`}>
        Vollständige Analyse öffnen
      </Link>
    </section>
  )
}
