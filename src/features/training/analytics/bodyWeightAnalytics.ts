import type { BodyWeightEntry } from '../model/trainingTypes'
import {
  isDateKeyInRange,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'

export interface BodyWeightSummary {
  currentKg?: number
  firstKg?: number
  minimumKg?: number
  maximumKg?: number
  measurementCount: number
  changeInRangeKg?: number
  changeFromPreviousKg?: number
}

export interface BodyWeightTrendPoint {
  date: string
  rawKg: number
  averageKg: number
}

function sortByDate(entries: readonly BodyWeightEntry[]) {
  return [...entries].sort((left, right) => left.date.localeCompare(right.date))
}

function roundKilograms(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function dateKeyToOrdinal(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function getBodyWeightSummary(
  entries: readonly BodyWeightEntry[],
  range: AnalyticsDateRange,
): BodyWeightSummary {
  const sorted = sortByDate(entries)
  const selected = sorted.filter(({ date }) => isDateKeyInRange(date, range))
  if (selected.length === 0) {
    return {
      currentKg: undefined,
      firstKg: undefined,
      minimumKg: undefined,
      maximumKg: undefined,
      measurementCount: 0,
      changeInRangeKg: undefined,
      changeFromPreviousKg: undefined,
    }
  }

  const first = selected[0]
  const current = selected[selected.length - 1]
  const previous = sorted
    .filter(({ date }) => date < current.date)
    .at(-1)

  return {
    currentKg: current.weightKg,
    firstKg: first.weightKg,
    minimumKg: Math.min(...selected.map(({ weightKg }) => weightKg)),
    maximumKg: Math.max(...selected.map(({ weightKg }) => weightKg)),
    measurementCount: selected.length,
    changeInRangeKg: roundKilograms(current.weightKg - first.weightKg),
    changeFromPreviousKg:
      previous === undefined
        ? undefined
        : roundKilograms(current.weightKg - previous.weightKg),
  }
}

export function getSevenDayBodyWeightTrend(
  entries: readonly BodyWeightEntry[],
  range: AnalyticsDateRange,
): BodyWeightTrendPoint[] {
  const sorted = sortByDate(entries)
  return sorted
    .filter(({ date }) => isDateKeyInRange(date, range))
    .map((current) => {
      const currentDay = dateKeyToOrdinal(current.date)
      const window = sorted.filter(({ date }) => {
        const day = dateKeyToOrdinal(date)
        return day <= currentDay && day >= currentDay - 6
      })
      const average =
        window.reduce((sum, { weightKg }) => sum + weightKg, 0) /
        window.length
      return {
        date: current.date,
        rawKg: current.weightKg,
        averageKg: roundKilograms(average),
      }
    })
}
