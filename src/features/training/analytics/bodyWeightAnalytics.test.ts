import { describe, expect, it } from 'vitest'
import type { BodyWeightEntry } from '../model/trainingTypes'
import {
  getBodyWeightSummary,
  getSevenDayBodyWeightTrend,
} from './bodyWeightAnalytics'

function entry(id: string, date: string, weightKg: number): BodyWeightEntry {
  return {
    id,
    date,
    weightKg,
    note: '',
    createdAt: `${date}T06:00:00.000Z`,
    updatedAt: `${date}T06:00:00.000Z`,
  }
}

const ENTRIES = [
  entry('before', '2026-06-29', 81),
  entry('first', '2026-07-01', 80),
  entry('middle', '2026-07-07', 78),
  entry('latest', '2026-07-09', 77),
  entry('after', '2026-08-01', 76),
]
const RANGE = { startDate: '2026-07-01', endDate: '2026-07-31' }

describe('body-weight analytics', () => {
  it('summarizes measurements inside the range and compares the latest values', () => {
    expect(getBodyWeightSummary(ENTRIES, RANGE)).toEqual({
      currentKg: 77,
      firstKg: 80,
      minimumKg: 77,
      maximumKg: 80,
      measurementCount: 3,
      changeInRangeKg: -3,
      changeFromPreviousKg: -1,
    })
  })

  it('returns undefined metrics instead of invented values when data is missing', () => {
    expect(getBodyWeightSummary([], RANGE)).toEqual({
      currentKg: undefined,
      firstKg: undefined,
      minimumKg: undefined,
      maximumKg: undefined,
      measurementCount: 0,
      changeInRangeKg: undefined,
      changeFromPreviousKg: undefined,
    })

    expect(
      getBodyWeightSummary([entry('only', '2026-07-04', 80)], RANGE),
    ).toMatchObject({
      measurementCount: 1,
      changeInRangeKg: 0,
      changeFromPreviousKg: undefined,
    })
  })

  it('uses the immediately previous measurement even when it is before the range', () => {
    expect(
      getBodyWeightSummary(
        [entry('before', '2026-06-30', 82), entry('current', '2026-07-01', 80)],
        RANGE,
      ).changeFromPreviousKg,
    ).toBe(-2)
  })

  it('calculates seven-calendar-day averages without treating missing days as zero', () => {
    expect(getSevenDayBodyWeightTrend(ENTRIES, RANGE)).toEqual([
      { date: '2026-07-01', rawKg: 80, averageKg: 80.5 },
      { date: '2026-07-07', rawKg: 78, averageKg: 79 },
      { date: '2026-07-09', rawKg: 77, averageKg: 77.5 },
    ])
  })

  it('returns only points inside the selected range', () => {
    expect(
      getSevenDayBodyWeightTrend(ENTRIES, {
        startDate: '2026-07-07',
        endDate: '2026-07-07',
      }),
    ).toEqual([{ date: '2026-07-07', rawKg: 78, averageKg: 79 }])
  })
})
