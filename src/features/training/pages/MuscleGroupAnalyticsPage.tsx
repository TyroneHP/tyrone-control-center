import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveDialog } from '../../../design-system'
import { resolveAnalyticsRange, toLocalDateKey } from '../analytics/dateRangeAnalytics'
import {
  getMuscleGroupAnalytics,
  type MuscleGroupResult,
} from '../analytics/muscleGroupAnalytics'
import { AnalyticsPeriodFilter } from '../components/AnalyticsPeriodFilter'
import { BarChart } from '../components/BarChart'
import type { MuscleMetric } from '../model/trainingTypes'
import { useTraining } from '../useTraining'

const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

export function MuscleGroupAnalyticsPage() {
  const { loading, state, updateAnalyticsPreferences } = useTraining()
  const [metricChoice, setMetricChoice] = useState(state.analyticsPreferences.muscleMetric)
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroupResult>()
  const availableDates = state.completedWorkouts.flatMap(({ completedAt }) => {
    try { return [toLocalDateKey(completedAt)] } catch { return [] }
  })
  const rangeResult = resolveAnalyticsRange(
    state.analyticsPreferences.range,
    new Date(),
    availableDates,
  )
  const groups = rangeResult.valid
    ? getMuscleGroupAnalytics(state.completedWorkouts, rangeResult.range)
      .sort((left, right) => {
        const difference = metricChoice === 'sets'
          ? right.weightedSets - left.weightedSets
          : right.volume - left.volume
        return difference || left.muscleGroup.localeCompare(right.muscleGroup, 'de')
      })
    : []
  const value = (group: MuscleGroupResult) =>
    metricChoice === 'sets' ? group.weightedSets : group.volume
  const percentage = (group: MuscleGroupResult) =>
    metricChoice === 'sets' ? group.setPercentage : group.volumePercentage
  const unit = metricChoice === 'sets' ? 'gewichtete Sätze' : 'kg'
  const chartTitle = metricChoice === 'sets'
    ? 'Gewichtete Sätze nach Muskelgruppe'
    : 'Volumen nach Muskelgruppe'

  if (loading) return <p>Muskelgruppen werden geladen …</p>

  return (
    <section aria-labelledby="muscles-heading" className="training-analytics-page">
      <header>
        <h1 id="muscles-heading">Muskelgruppen</h1>
        <p>Primärmuskeln zählen zu 100 %, jeder Sekundärmuskel zu 50 %. Deshalb kann die Summe über dem reinen Trainingsvolumen liegen.</p>
      </header>
      <AnalyticsPeriodFilter
        onChange={(range) => updateAnalyticsPreferences({ range })}
        value={state.analyticsPreferences.range}
      />
      <label>
        Kennzahl
        <select
          onChange={(event) => {
            const muscleMetric = event.target.value as MuscleMetric
            setMetricChoice(muscleMetric)
            updateAnalyticsPreferences({ muscleMetric })
          }}
          value={metricChoice}
        >
          <option value="sets">Gewichtete Sätze</option>
          <option value="volume">Volumen</option>
        </select>
      </label>
      {groups.length ? (
        <>
          <BarChart
            ariaLabel={chartTitle}
            data={groups.map((group) => ({
              id: group.muscleGroup, label: group.muscleGroup, value: value(group),
              description: `${numberFormatter.format(percentage(group))} %`,
            }))}
            onSelect={(point) => setSelectedGroup(groups.find(({ muscleGroup }) => muscleGroup === point.id))}
            unit={unit}
          />
          <ol aria-label="Muskelgruppen-Rangliste" className="muscle-ranking">
            {groups.map((group) => (
              <li key={group.muscleGroup}>
                <button onClick={() => setSelectedGroup(group)} type="button">
                  <strong>{group.muscleGroup}</strong>{' '}
                  <span>{numberFormatter.format(value(group))} {unit}</span>{' '}
                  <span>({numberFormatter.format(percentage(group))} %)</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : <p>Noch keine Muskelgruppen-Daten im gewählten Zeitraum vorhanden.</p>}

      <ResponsiveDialog
        actions={<button className="button--secondary" onClick={() => setSelectedGroup(undefined)} type="button">Schließen</button>}
        onClose={() => setSelectedGroup(undefined)}
        open={selectedGroup !== undefined}
        title={selectedGroup ? `Muskelgruppe ${selectedGroup.muscleGroup}` : 'Muskelgruppe'}
      >
        {selectedGroup ? (
          <ul className="muscle-contributions">
            {selectedGroup.contributions.map((contribution) => (
              <li key={contribution.exerciseId}>
                <strong>{contribution.exerciseName}</strong>
                <span>{numberFormatter.format(contribution.weightedSets)} gewichtete Sätze</span>
                <span>{numberFormatter.format(contribution.volume)} kg Volumen</span>
                <Link to={`/training/progress/exercises?exercise=${encodeURIComponent(contribution.exerciseId)}`}>
                  {contribution.exerciseName} analysieren
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </ResponsiveDialog>
    </section>
  )
}
