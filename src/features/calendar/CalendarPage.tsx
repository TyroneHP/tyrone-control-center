import { useState } from 'react'
import { MonthCalendar } from './MonthCalendar'
import { shiftMonth } from './calendarModel'
import './calendar.css'

export interface CalendarPageProps {
  today?: Date
}

export function CalendarPage({ today = new Date() }: CalendarPageProps) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  return (
    <section className="calendar-page">
      <header className="calendar-page__header">
        <p>Planung</p>
        <h1>Kalender</h1>
        <p>Deine Monatsübersicht.</p>
      </header>

      <MonthCalendar
        month={visibleMonth}
        onNextMonth={() =>
          setVisibleMonth((month) => shiftMonth(month, 1))
        }
        onPreviousMonth={() =>
          setVisibleMonth((month) => shiftMonth(month, -1))
        }
        today={today}
      />
    </section>
  )
}
