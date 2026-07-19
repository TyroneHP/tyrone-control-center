import { useId } from 'react'
import { Button, Card } from '../../design-system'
import type { CalendarEvent } from './calendarEvents'

export interface SelectedDayEventsProps {
  date: string
  events: CalendarEvent[]
  onEdit: (event: CalendarEvent) => void
}

function formatSelectedDate(date: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function formatEventTime(event: CalendarEvent) {
  if (event.startTime && event.endTime) return `${event.startTime}–${event.endTime}`
  return event.startTime ?? event.endTime
}

export function SelectedDayEvents({ date, events, onEdit }: SelectedDayEventsProps) {
  const headingId = useId()
  const dateLabel = formatSelectedDate(date)

  return (
    <Card aria-labelledby={headingId}>
      <h2 id={headingId}>{`Termine am ${dateLabel}`}</h2>
      {events.length === 0 ? (
        <p>Für diesen Tag sind keine Termine eingetragen.</p>
      ) : (
        <div>
          {events.map((event) => {
            const time = formatEventTime(event)
            return (
              <article key={event.id}>
                {time ? <p>{time}</p> : null}
                <h3>{event.title}</h3>
                {event.description ? <p>{event.description}</p> : null}
                <Button
                  aria-label={`${event.title} bearbeiten`}
                  onClick={() => onEdit(event)}
                  type="button"
                  variant="secondary"
                >
                  Bearbeiten
                </Button>
              </article>
            )
          })}
        </div>
      )}
    </Card>
  )
}
