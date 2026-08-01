import type { AnalyticsRangeSelection } from '../model/trainingTypes'

export interface AnalyticsDateRange {
  startDate: string
  endDate: string
}

export type DateRangeResult =
  | { valid: true; range: AnalyticsDateRange }
  | { valid: false; reason: string }

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function isValidDateKey(value: string) {
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(year, month - 1, day, 12)
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  )
}

export function toLocalDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Ungültiger Datumswert.')
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function subtractLocalDays(today: Date, days: number) {
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  )
  date.setDate(date.getDate() - days)
  return date
}

function subtractCalendarMonths(today: Date, months: number) {
  const targetMonth = new Date(
    today.getFullYear(),
    today.getMonth() - months,
    1,
    12,
  )
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate()
  targetMonth.setDate(Math.min(today.getDate(), lastDay))
  return targetMonth
}

export function resolveAnalyticsRange(
  selection: AnalyticsRangeSelection,
  today: Date,
  availableDates: readonly string[],
): DateRangeResult {
  const endDate = toLocalDateKey(today)

  if (selection.preset === 'custom') {
    if (
      !isValidDateKey(selection.startDate) ||
      !isValidDateKey(selection.endDate)
    ) {
      return { valid: false, reason: 'Bitte gib einen gültigen Zeitraum an.' }
    }
    if (selection.startDate > selection.endDate) {
      return {
        valid: false,
        reason: 'Das Startdatum darf nicht nach dem Enddatum liegen.',
      }
    }
    return {
      valid: true,
      range: {
        startDate: selection.startDate,
        endDate: selection.endDate,
      },
    }
  }

  if (selection.preset === 'all') {
    const startDate = availableDates
      .filter((dateKey) => isValidDateKey(dateKey) && dateKey <= endDate)
      .sort()[0]
    return {
      valid: true,
      range: { startDate: startDate ?? endDate, endDate },
    }
  }

  const start =
    selection.preset === '7d'
      ? subtractLocalDays(today, 6)
      : selection.preset === '30d'
        ? subtractLocalDays(today, 29)
        : subtractCalendarMonths(
            today,
            selection.preset === '3m'
              ? 3
              : selection.preset === '6m'
                ? 6
                : 12,
          )

  return {
    valid: true,
    range: { startDate: toLocalDateKey(start), endDate },
  }
}

export function isDateKeyInRange(
  dateKey: string,
  range: AnalyticsDateRange,
) {
  return (
    isValidDateKey(dateKey) &&
    isValidDateKey(range.startDate) &&
    isValidDateKey(range.endDate) &&
    range.startDate <= dateKey &&
    dateKey <= range.endDate
  )
}
