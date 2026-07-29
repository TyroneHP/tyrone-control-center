import { useState } from 'react'
import type { AnalyticsRangeSelection } from '../model/trainingTypes'

export interface AnalyticsPeriodFilterProps {
  value: AnalyticsRangeSelection
  onChange: (selection: AnalyticsRangeSelection) => void
}

const OPTIONS = [
  ['7d', '7 Tage'],
  ['30d', '30 Tage'],
  ['3m', '3 Monate'],
  ['6m', '6 Monate'],
  ['1y', '1 Jahr'],
  ['all', 'Gesamt'],
  ['custom', 'Eigener Zeitraum'],
] as const

export function AnalyticsPeriodFilter({
  onChange,
  value,
}: AnalyticsPeriodFilterProps) {
  const [mode, setMode] = useState(value.preset)
  const [startDate, setStartDate] = useState(
    value.preset === 'custom' ? value.startDate : '',
  )
  const [endDate, setEndDate] = useState(
    value.preset === 'custom' ? value.endDate : '',
  )

  const error =
    mode === 'custom' && startDate && endDate && startDate > endDate
      ? 'Das Startdatum darf nicht nach dem Enddatum liegen.'
      : undefined

  const applyCustom = (nextStart: string, nextEnd: string) => {
    if (nextStart && nextEnd && nextStart <= nextEnd) {
      onChange({ preset: 'custom', startDate: nextStart, endDate: nextEnd })
    }
  }

  return (
    <fieldset className="analytics-period-filter">
      <legend>Auswertungszeitraum</legend>
      <label>
        Zeitraum
        <select
          value={mode}
          onChange={(event) => {
            const preset = event.target.value as AnalyticsRangeSelection['preset']
            setMode(preset)
            if (preset !== 'custom') onChange({ preset })
          }}
        >
          {OPTIONS.map(([preset, label]) => (
            <option key={preset} value={preset}>{label}</option>
          ))}
        </select>
      </label>
      {mode === 'custom' ? (
        <div className="analytics-period-filter__custom">
          <label>
            Startdatum
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                applyCustom(event.target.value, endDate)
              }}
            />
          </label>
          <label>
            Enddatum
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                applyCustom(startDate, event.target.value)
              }}
            />
          </label>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  )
}
