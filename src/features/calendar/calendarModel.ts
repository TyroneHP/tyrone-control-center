const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

const dateLabelFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})

export const CALENDAR_WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const

export interface CalendarDay {
  date: Date
  dateLabel: string
  dayNumber: number
  isoDate: string
  isCurrentMonth: boolean
  isToday: boolean
}

function sameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function toLocalIsoDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildMonthGrid(
  visibleMonth: Date,
  today: Date,
): CalendarDay[] {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const monthStart = new Date(year, month, 1)
  const daysBeforeMonday = (monthStart.getDay() + 6) % 7

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - daysBeforeMonday + index)
    return {
      date,
      dateLabel: dateLabelFormatter.format(date),
      dayNumber: date.getDate(),
      isoDate: toLocalIsoDate(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: sameCalendarDate(date, today),
    }
  })
}

export function formatMonthLabel(date: Date) {
  return monthFormatter.format(date)
}

export function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}
