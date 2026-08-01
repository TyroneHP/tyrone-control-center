import { describe, expect, it } from 'vitest'
import {
  isDateKeyInRange,
  resolveAnalyticsRange,
  toLocalDateKey,
} from './dateRangeAnalytics'

function localNoon(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

describe('local analytics date ranges', () => {
  it.each([
    ['7d', '2026-07-23'],
    ['30d', '2026-06-30'],
  ] as const)('resolves the inclusive %s range', (preset, startDate) => {
    expect(
      resolveAnalyticsRange(
        { preset },
        localNoon('2026-07-29'),
        [],
      ),
    ).toEqual({
      valid: true,
      range: { startDate, endDate: '2026-07-29' },
    })
  })

  it.each([
    ['3m', '2026-04-29'],
    ['6m', '2026-01-29'],
    ['1y', '2025-07-29'],
  ] as const)('resolves %s with calendar-month arithmetic', (preset, startDate) => {
    expect(
      resolveAnalyticsRange(
        { preset },
        localNoon('2026-07-29'),
        [],
      ),
    ).toEqual({
      valid: true,
      range: { startDate, endDate: '2026-07-29' },
    })
  })

  it('clamps calendar-month ranges at the target month end', () => {
    expect(
      resolveAnalyticsRange(
        { preset: '3m' },
        localNoon('2026-07-31'),
        [],
      ),
    ).toEqual({
      valid: true,
      range: { startDate: '2026-04-30', endDate: '2026-07-31' },
    })
  })

  it('uses the oldest valid available local date for the all range', () => {
    expect(
      resolveAnalyticsRange(
        { preset: 'all' },
        localNoon('2026-07-29'),
        ['2026-04-12', '2026-01-03', 'invalid', '2026-08-01'],
      ),
    ).toEqual({
      valid: true,
      range: { startDate: '2026-01-03', endDate: '2026-07-29' },
    })
    expect(
      resolveAnalyticsRange(
        { preset: 'all' },
        localNoon('2026-07-29'),
        [],
      ),
    ).toEqual({
      valid: true,
      range: { startDate: '2026-07-29', endDate: '2026-07-29' },
    })
  })

  it('keeps custom bounds inclusive and rejects reversed bounds', () => {
    expect(
      resolveAnalyticsRange(
        {
          preset: 'custom',
          startDate: '2026-07-01',
          endDate: '2026-07-29',
        },
        localNoon('2026-07-29'),
        [],
      ),
    ).toEqual({
      valid: true,
      range: { startDate: '2026-07-01', endDate: '2026-07-29' },
    })
    expect(
      resolveAnalyticsRange(
        {
          preset: 'custom',
          startDate: '2026-07-30',
          endDate: '2026-07-29',
        },
        localNoon('2026-07-29'),
        [],
      ),
    ).toEqual({
      valid: false,
      reason: 'Das Startdatum darf nicht nach dem Enddatum liegen.',
    })
  })

  it('derives date keys from local fields instead of UTC substrings', () => {
    const justAfterLocalMidnight = new Date(2026, 0, 1, 0, 15)

    expect(toLocalDateKey(justAfterLocalMidnight)).toBe('2026-01-01')
    expect(toLocalDateKey(justAfterLocalMidnight.toISOString())).toBe(
      '2026-01-01',
    )
  })

  it('compares valid local date keys with inclusive bounds', () => {
    const range = { startDate: '2026-07-01', endDate: '2026-07-29' }

    expect(isDateKeyInRange('2026-07-01', range)).toBe(true)
    expect(isDateKeyInRange('2026-07-29', range)).toBe(true)
    expect(isDateKeyInRange('2026-06-30', range)).toBe(false)
    expect(isDateKeyInRange('not-a-date', range)).toBe(false)
  })
})
