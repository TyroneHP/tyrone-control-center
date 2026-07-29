import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ResponsiveDialog } from '../../../design-system'
import { getBalanceInsights } from '../analytics/balanceInsightAnalytics'
import { getDashboardMetrics } from '../analytics/dashboardAnalytics'
import {
  isDateKeyInRange,
  resolveAnalyticsRange,
  toLocalDateKey,
} from '../analytics/dateRangeAnalytics'
import { getTrainingHeatmap } from '../analytics/heatmapAnalytics'
import { getMuscleGroupAnalytics } from '../analytics/muscleGroupAnalytics'
import { roundAnalyticsValue } from '../analytics/loadAnalytics'
import { AnalyticsPeriodFilter } from '../components/AnalyticsPeriodFilter'
import { TrainingHeatmap } from '../components/TrainingHeatmap'
import { useTraining } from '../useTraining'

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`))
}

export function ProgressDashboardPage() {
  const {
    dismissBalanceInsight,
    loading,
    state,
    updateAnalyticsPreferences,
  } = useTraining()
  const [selectedDate, setSelectedDate] = useState<string>()
  const availableDates = useMemo(() => [
    ...state.completedWorkouts.flatMap(({ completedAt }) => {
      try {
        return [toLocalDateKey(completedAt)]
      } catch {
        return []
      }
    }),
    ...state.bodyWeightEntries.map(({ date }) => date),
  ], [state.bodyWeightEntries, state.completedWorkouts])
  const rangeResult = useMemo(
    () => resolveAnalyticsRange(
      state.analyticsPreferences.range,
      new Date(),
      availableDates,
    ),
    [availableDates, state.analyticsPreferences.range],
  )

  const analytics = useMemo(() => {
    if (!rangeResult.valid) return undefined
    const range = rangeResult.range
    const metrics = getDashboardMetrics(
      state.completedWorkouts,
      state.bodyWeightEntries,
      range,
    )
    const heatmap = getTrainingHeatmap(state.completedWorkouts, range)
    const muscleGroups = getMuscleGroupAnalytics(
      state.completedWorkouts,
      range,
    )
    const workoutsInRange = state.completedWorkouts.filter(({ completedAt }) => {
      try {
        return isDateKeyInRange(toLocalDateKey(completedAt), range)
      } catch {
        return false
      }
    })
    const insights = getBalanceInsights(
      workoutsInRange,
      muscleGroups,
      state.analyticsPreferences.dismissedBalanceInsightIds,
    )
    return { heatmap, insights, metrics }
  }, [rangeResult, state])
  const selectedDay = analytics?.heatmap.find(
    ({ date }) => date === selectedDate,
  )

  if (loading) return <p>Fortschritt wird geladen …</p>

  return (
    <section aria-labelledby="progress-heading" className="training-analytics-page">
      <header>
        <p className="eyebrow">Training</p>
        <h1 id="progress-heading">Fortschritt</h1>
        <p>Deine Trainingsdaten bleiben lokal auf diesem Gerät.</p>
      </header>

      <AnalyticsPeriodFilter
        onChange={(range) => updateAnalyticsPreferences({ range })}
        value={state.analyticsPreferences.range}
      />
      {!rangeResult.valid ? <p role="alert">{rangeResult.reason}</p> : null}

      {analytics ? (
        <>
          <dl aria-label="Fortschrittskennzahlen" className="analytics-metrics">
            <div><dt>Trainings</dt><dd>{analytics.metrics.workoutCount}</dd></div>
            <div><dt>Abgeschlossene Sätze</dt><dd>{analytics.metrics.completedSetCount}</dd></div>
            <div><dt>Neue Rekorde</dt><dd>{analytics.metrics.newRecordCount}</dd></div>
            <div>
              <dt>Körpergewichtsänderung</dt>
              <dd>{analytics.metrics.bodyWeightChangeKg === undefined ? 'Keine Messdaten' : `${numberFormatter.format(analytics.metrics.bodyWeightChangeKg)} kg`}</dd>
            </div>
            <div><dt>Trainingstage</dt><dd>{analytics.metrics.workoutDays}</dd></div>
            <div><dt>Trainings pro Woche</dt><dd>{numberFormatter.format(analytics.metrics.workoutsPerWeek)}</dd></div>
            <div>
              <dt>Gesamtdauer</dt>
              <dd>{analytics.metrics.totalDurationMinutes === undefined ? 'Keine Messdaten' : `${analytics.metrics.totalDurationMinutes} Min.`}</dd>
            </div>
          </dl>

          <section aria-labelledby="heatmap-heading">
            <h2 id="heatmap-heading">Trainingsaktivität</h2>
            <p>Die Intensität zeigt die Anzahl abgeschlossener Sätze, ohne Wertung.</p>
            <div className="training-heatmap-scroll">
              <TrainingHeatmap
                days={analytics.heatmap}
                onSelect={setSelectedDate}
                selectedDate={selectedDate}
              />
            </div>
          </section>

          {analytics.insights.length > 0 ? (
            <section aria-labelledby="balance-heading">
              <h2 id="balance-heading">Balance-Orientierung</h2>
              <div className="balance-insights">
                {analytics.insights.map((insight) => (
                  <Card aria-label={`Orientierung: ${insight.smallerGroupLabel}`} key={insight.id} role="article">
                    <strong>Orientierung</strong>
                    <p>{insight.message}</p>
                    <p>{numberFormatter.format(roundAnalyticsValue(insight.smallerWeightedSets))} zu {numberFormatter.format(roundAnalyticsValue(insight.comparisonWeightedSets))} gewichteten Sätzen</p>
                    <button className="button--secondary" onClick={() => dismissBalanceInsight(insight.id)} type="button">
                      Hinweis ausblenden
                    </button>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <nav aria-label="Fortschritts-Schnellzugriffe" className="analytics-quick-links">
            <Link to="/training/progress/exercises">Übungsfortschritt öffnen</Link>
            <Link to="/training/progress/records">Rekorde öffnen</Link>
            <Link to="/training/progress/muscles">Muskelgruppen öffnen</Link>
            <Link to="/training/progress/bodyweight">Körpergewicht öffnen</Link>
          </nav>
        </>
      ) : null}

      <ResponsiveDialog
        actions={(
          <button className="button--secondary" onClick={() => setSelectedDate(undefined)} type="button">
            Schließen
          </button>
        )}
        onClose={() => setSelectedDate(undefined)}
        open={selectedDay !== undefined}
        title={selectedDay ? `Trainings am ${formatDate(selectedDay.date)}` : 'Trainingsdetails'}
      >
        {selectedDay ? (
          selectedDay.workouts.length ? <ul className="heatmap-day-details">
            {selectedDay.workouts.map((workout) => (
              <li key={workout.workoutId}>
                <h3>{workout.workoutName}</h3>
                <p>{workout.status === 'complete' ? 'Vollständig' : 'Unvollständig'}</p>
                <p>{workout.exerciseCount} Übungen · {workout.completedSetCount} abgeschlossene Sätze</p>
                <p>{workout.durationMinutes === undefined ? 'Dauer nicht verfügbar' : `${workout.durationMinutes} Min.`}</p>
                <Link to={`/training/history/${workout.workoutId}`}>Im Verlauf öffnen</Link>
              </li>
            ))}
          </ul> : <p>An diesem Tag wurde kein Training abgeschlossen.</p>
        ) : null}
      </ResponsiveDialog>
    </section>
  )
}
