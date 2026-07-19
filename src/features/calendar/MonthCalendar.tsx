import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card } from '../../design-system'
import {
  buildMonthGrid,
  CALENDAR_WEEKDAYS,
  formatMonthLabel,
} from './calendarModel'
import './calendar.css'

export interface MonthCalendarProps {
  month: Date
  onNextMonth: () => void
  onPreviousMonth: () => void
  today: Date
}

export function MonthCalendar({
  month,
  onNextMonth,
  onPreviousMonth,
  today,
}: MonthCalendarProps) {
  const days = buildMonthGrid(month, today)
  const monthLabel = formatMonthLabel(month)
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
                {week.map((day) => (
                  <td
                    className="month-calendar__day"
                    data-outside-month={!day.isCurrentMonth}
                    key={day.isoDate}
                  >
                    <time
                      aria-current={day.isToday ? 'date' : undefined}
                      aria-label={day.dateLabel}
                      dateTime={day.isoDate}
                    >
                      {day.dayNumber}
                    </time>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
