import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card } from '../../design-system'
import {
  buildMonthGrid,
  CALENDAR_WEEKDAYS,
  formatMonthLabel,
} from './calendarModel'
import type { CalendarEvent } from './calendarEvents'
import './calendar.css'

export interface MonthCalendarProps {
  events?: CalendarEvent[]
  month: Date
  onNextMonth: () => void
  onPreviousMonth: () => void
  onSelectDate?: (date: string) => void
  selectedDate?: string
  today: Date
}

function eventCountLabel(count: number) {
  if (count === 0) return 'kein Termin'
  if (count === 1) return '1 Termin'
  return `${count} Termine`
}

export function MonthCalendar({
  events = [],
  month,
  onNextMonth,
  onPreviousMonth,
  onSelectDate = () => undefined,
  selectedDate = '',
  today,
}: MonthCalendarProps) {
  const days = buildMonthGrid(month, today)
  const monthLabel = formatMonthLabel(month)
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const dayEvents = eventsByDate.get(event.date)
    if (dayEvents) {
      dayEvents.push(event)
    } else {
      eventsByDate.set(event.date, [event])
    }
  }
  const weeks = Array.from({ length: 6 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  )

  return (
    <Card className="calendar-card">
      <div className="calendar-toolbar">
        <Button
          aria-label="Vorheriger Monat"
          className="calendar-toolbar__button"
          onClick={onPreviousMonth}
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Button>
        <h2 aria-live="polite" className="calendar-toolbar__title">
          {monthLabel}
        </h2>
        <Button
          aria-label="Nächster Monat"
          className="calendar-toolbar__button"
          onClick={onNextMonth}
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </Button>
      </div>

      <div className="month-calendar__viewport">
        <table className="month-calendar">
          <caption className="calendar-visually-hidden">
            {`Monatskalender ${monthLabel}`}
          </caption>
          <thead>
            <tr>
              {CALENDAR_WEEKDAYS.map((weekday) => (
                <th key={weekday} scope="col">
                  <abbr title={weekday}>{weekday.slice(0, 2)}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].isoDate}>
                {week.map((day) => {
                  const dayEvents = eventsByDate.get(day.isoDate) ?? []

                  return (
                    <td
                      className="month-calendar__day"
                      data-outside-month={!day.isCurrentMonth}
                      key={day.isoDate}
                    >
                      <button
                        aria-label={`${day.dateLabel}, ${eventCountLabel(dayEvents.length)}`}
                        aria-pressed={selectedDate === day.isoDate}
                        className="month-calendar__day-button"
                        data-date={day.isoDate}
                        onClick={() => onSelectDate(day.isoDate)}
                        type="button"
                      >
                        <time
                          aria-current={day.isToday ? 'date' : undefined}
                          dateTime={day.isoDate}
                        >
                          {day.dayNumber}
                        </time>
                        <span
                          aria-hidden="true"
                          className="month-calendar__event-previews"
                        >
                          {dayEvents.slice(0, 2).map((event) => (
                            <span
                              className="month-calendar__event-preview"
                              key={event.id}
                            >
                              {event.startTime ? <span>{event.startTime}</span> : null}
                              <span>{event.title}</span>
                            </span>
                          ))}
                        </span>
                        {dayEvents.length > 0 ? (
                          <span
                            aria-hidden="true"
                            className="month-calendar__event-count"
                          >
                            {dayEvents.length}
                          </span>
                        ) : null}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
