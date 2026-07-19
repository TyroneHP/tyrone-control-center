import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  formatMonthLabel,
  shiftMonth,
} from './calendarModel'

describe('calendar month model', () => {
  it('builds a Monday-first six-week grid with adjacent dates', () => {
    const days = buildMonthGrid(new Date(2026, 6, 1), new Date(2026, 6, 16))

    expect(days).toHaveLength(42)
    expect(days[0]).toMatchObject({
      isoDate: '2026-06-29',
      isCurrentMonth: false,
    })
    expect(days[41].isoDate).toBe('2026-08-09')
    expect(days.find((day) => day.isToday)?.isoDate).toBe('2026-07-16')
  })

  it('includes leap day in February 2028', () => {
    const days = buildMonthGrid(new Date(2028, 1, 1), new Date(2028, 1, 29))

    expect(days).toContainEqual(
      expect.objectContaining({
        isoDate: '2028-02-29',
        isCurrentMonth: true,
        isToday: true,
      }),
    )
  })

  it('moves across year boundaries from the first of the month', () => {
    expect(shiftMonth(new Date(2026, 11, 31), 1)).toEqual(
      new Date(2027, 0, 1),
    )
    expect(shiftMonth(new Date(2026, 0, 31), -1)).toEqual(
      new Date(2025, 11, 1),
    )
    expect(formatMonthLabel(new Date(2026, 6, 1))).toBe('Juli 2026')
  })
})
