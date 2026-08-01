import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  isDateKeyInRange,
  resolveAnalyticsRange,
  toLocalDateKey,
} from '../analytics/dateRangeAnalytics'
import {
  getAllExerciseRecordHistory,
  getExerciseRecords,
  type ExerciseRecordType,
  type RecordHistoryEntry,
} from '../analytics/recordAnalytics'
import { AnalyticsPeriodFilter } from '../components/AnalyticsPeriodFilter'
import { useTraining } from '../useTraining'

const RECORDS: Record<ExerciseRecordType, { label: string; unit: string }> = {
  weight: { label: 'Höchstes Gewicht', unit: 'kg' },
  setVolume: { label: 'Höchstes Satzvolumen', unit: 'kg' },
  reps: { label: 'Meiste Wiederholungen', unit: 'Wdh.' },
}
const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

function valueLabel(entry: Pick<RecordHistoryEntry, 'recordType' | 'value'>) {
  return `${numberFormatter.format(entry.value)} ${RECORDS[entry.recordType].unit}`
}

export function RecordAnalyticsPage() {
  const { loading, state, updateAnalyticsPreferences } = useTraining()
  const [recordType, setRecordType] = useState<ExerciseRecordType | 'all'>('all')
  const [muscle, setMuscle] = useState('')
  const [query, setQuery] = useState('')
  const availableDates = state.completedWorkouts.flatMap(({ completedAt }) => {
    try { return [toLocalDateKey(completedAt)] } catch { return [] }
  })
  const rangeResult = resolveAnalyticsRange(
    state.analyticsPreferences.range,
    new Date(),
    availableDates,
  )
  const lifetimeRecords = useMemo(
    () => getExerciseRecords(state.completedWorkouts),
    [state.completedWorkouts],
  )
  const periodHistory = useMemo(() => {
    if (!rangeResult.valid) return []
    return getAllExerciseRecordHistory(state.completedWorkouts).filter(({ date }) =>
      isDateKeyInRange(date, rangeResult.range),
    )
  }, [rangeResult, state.completedWorkouts])
  const muscles = [...new Set(
    [...lifetimeRecords, ...periodHistory].flatMap(({ primaryMuscles }) => primaryMuscles),
  )].sort((left, right) => left.localeCompare(right, 'de'))
  const matches = (entry: RecordHistoryEntry) =>
    (recordType === 'all' || entry.recordType === recordType) &&
    (!muscle || entry.primaryMuscles.includes(muscle)) &&
    (!query.trim() || entry.exerciseName.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de')))
  const filteredRecords = lifetimeRecords.filter(matches)
  const filteredHistory = periodHistory.filter(matches)
  const groupedRecords = Map.groupBy(filteredRecords, ({ exerciseId }) => exerciseId)

  if (loading) return <p>Rekorde werden geladen …</p>

  return (
    <section aria-labelledby="records-heading" className="training-analytics-page">
      <header>
        <h1 id="records-heading">Persönliche Rekorde</h1>
        <p>Rekorde werden jederzeit aus deinem lokalen Trainingsverlauf neu aufgebaut.</p>
      </header>
      <AnalyticsPeriodFilter
        onChange={(range) => updateAnalyticsPreferences({ range })}
        value={state.analyticsPreferences.range}
      />
      <div className="analytics-filter-row">
        <label>Übung suchen<input onChange={(event) => setQuery(event.target.value)} type="search" value={query} /></label>
        <label>
          Rekordart
          <select onChange={(event) => setRecordType(event.target.value as ExerciseRecordType | 'all')} value={recordType}>
            <option value="all">Alle Rekordarten</option>
            {Object.entries(RECORDS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Muskelgruppe
          <select onChange={(event) => setMuscle(event.target.value)} value={muscle}>
            <option value="">Alle Muskelgruppen</option>
            {muscles.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <section aria-labelledby="current-records-heading">
        <h2 id="current-records-heading">Aktuelle Rekorde (Gesamtzeit)</h2>
        <p>Diese Bestwerte gelten unabhängig vom gewählten Zeitraum.</p>
        {groupedRecords.size ? (
          <div className="record-card-grid">
            {[...groupedRecords.values()].map((records) => (
              <article aria-label={`Rekorde: ${records[0].exerciseName}`} className="card" key={records[0].exerciseId}>
                <h3>{records[0].exerciseName}</h3>
                <dl>
                  {records.map((record) => (
                    <div key={record.recordType}>
                      <dt>{RECORDS[record.recordType].label}</dt>
                      <dd>{valueLabel(record)}</dd>
                    </div>
                  ))}
                </dl>
                <Link to={`/training/progress/exercises?exercise=${encodeURIComponent(records[0].exerciseId)}`}>Übungsanalyse öffnen</Link>
              </article>
            ))}
          </div>
        ) : <p>Keine Rekorde für diese Filter.</p>}
      </section>

      <section aria-labelledby="record-history-heading">
        <h2 id="record-history-heading">Verbesserungen im gewählten Zeitraum</h2>
        {filteredHistory.length ? (
          <ol aria-label="Rekordhistorie" className="record-history">
            {filteredHistory.map((entry) => (
              <li key={`${entry.workoutId}:${entry.setId}:${entry.recordType}`}>
                <strong>{entry.exerciseName}: {RECORDS[entry.recordType].label}</strong>
                <span>{valueLabel(entry)}{entry.previousValue === undefined ? '' : `, vorher ${numberFormatter.format(entry.previousValue)} ${RECORDS[entry.recordType].unit}`}</span>
                <span>{dateFormatter.format(new Date(`${entry.date}T12:00:00.000Z`))} · Satz {entry.setNumber}</span>
                <Link to={`/training/history/${entry.workoutId}`}>Training {entry.workoutId} öffnen</Link>
              </li>
            ))}
          </ol>
        ) : <p>Keine Verbesserungen im gewählten Zeitraum.</p>}
      </section>
    </section>
  )
}
