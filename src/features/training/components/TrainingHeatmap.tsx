import type { HeatmapDay } from '../analytics/heatmapAnalytics'

export interface TrainingHeatmapProps {
  days: readonly HeatmapDay[]
  onSelect: (date: string) => void
  selectedDate?: string
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`))
}

export function TrainingHeatmap({
  days,
  onSelect,
  selectedDate,
}: TrainingHeatmapProps) {
  if (days.length === 0) {
    return <p>Keine Trainingsaktivität in diesem Zeitraum.</p>
  }
  return (
    <div aria-label="Trainingsaktivität" className="training-heatmap" role="group">
      {days.map((day) => {
        const status = [
          day.hasCompleteWorkout ? 'vollständig' : '',
          day.hasIncompleteWorkout ? 'unvollständig' : '',
        ].filter(Boolean).join(' und ')
        return (
          <button
            aria-label={`${formatDate(day.date)}: ${day.completedSetCount} abgeschlossene Sätze, ${status}`}
            aria-pressed={selectedDate === day.date}
            className={[
              'training-heatmap__day',
              day.hasCompleteWorkout ? 'has-complete' : '',
              day.hasIncompleteWorkout ? 'has-incomplete' : '',
            ].filter(Boolean).join(' ')}
            key={day.date}
            onClick={() => onSelect(day.date)}
            style={{ minHeight: '44px', minWidth: '44px' }}
            type="button"
          >
            <span aria-hidden="true">{day.hasCompleteWorkout ? '✓' : ''}</span>
            <span>{day.completedSetCount}</span>
            <span aria-hidden="true">{day.hasIncompleteWorkout ? '!' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
