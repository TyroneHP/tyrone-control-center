import { describe, expect, it } from 'vitest'
import type { BodyWeightEntry } from './trainingTypes'
import {
  BodyWeightDateConflictError,
  deleteBodyWeightEntry,
  findBodyWeightForWorkoutDate,
  moveBodyWeightEntry,
  upsertBodyWeightEntry,
} from './bodyWeightModel'

const FIRST: BodyWeightEntry = {
  id: 'weight-1',
  date: '2026-07-20',
  weightKg: 81.5,
  note: 'Morgens',
  createdAt: '2026-07-20T06:00:00.000Z',
  updatedAt: '2026-07-20T06:00:00.000Z',
}

const SECOND: BodyWeightEntry = {
  id: 'weight-2',
  date: '2026-07-25',
  weightKg: 81,
  note: '',
  createdAt: '2026-07-25T06:00:00.000Z',
  updatedAt: '2026-07-25T06:00:00.000Z',
}

describe('body-weight model', () => {
  it('creates a stable, sorted entry and updates the same day in place', () => {
    const created = upsertBodyWeightEntry(
      [SECOND],
      { date: '2026-07-20', weightKg: 81.5, note: 'Morgens' },
      '2026-07-20T06:00:00.000Z',
      () => 'weight-1',
    )
    const updated = upsertBodyWeightEntry(
      created,
      { date: '2026-07-20', weightKg: 81.2, note: 'Korrigiert' },
      '2026-07-20T07:00:00.000Z',
      () => 'must-not-be-used',
    )

    expect(created.map(({ id }) => id)).toEqual(['weight-1', 'weight-2'])
    expect(updated[0]).toEqual({
      ...FIRST,
      weightKg: 81.2,
      note: 'Korrigiert',
      updatedAt: '2026-07-20T07:00:00.000Z',
    })
    expect(updated[0].id).toBe('weight-1')
    expect(updated[0].createdAt).toBe(FIRST.createdAt)
    expect(updated).not.toBe(created)
  })

  it('moves an entry to a free date without changing identity or creation time', () => {
    const result = moveBodyWeightEntry(
      [FIRST, SECOND],
      'weight-2',
      { date: '2026-07-18', weightKg: 80.9, note: 'Nachgetragen' },
      '2026-07-29T09:00:00.000Z',
    )

    expect(result[0]).toEqual({
      ...SECOND,
      date: '2026-07-18',
      weightKg: 80.9,
      note: 'Nachgetragen',
      updatedAt: '2026-07-29T09:00:00.000Z',
    })
    expect(result[1]).toBe(FIRST)
  })

  it('rejects moving an entry onto another occupied local day', () => {
    expect(() =>
      moveBodyWeightEntry(
        [FIRST, SECOND],
        'weight-2',
        { date: FIRST.date, weightKg: 81, note: '' },
        '2026-07-29T09:00:00.000Z',
      ),
    ).toThrow(BodyWeightDateConflictError)
  })

  it('deletes only the selected entry without mutating the input', () => {
    const entries = [FIRST, SECOND]
    const result = deleteBodyWeightEntry(entries, FIRST.id)

    expect(result).toEqual([SECOND])
    expect(result).not.toBe(entries)
    expect(entries).toEqual([FIRST, SECOND])
  })

  it('finds exact and most recent earlier body weight but never a future value', () => {
    expect(findBodyWeightForWorkoutDate([SECOND, FIRST], '2026-07-25')).toBe(
      SECOND,
    )
    expect(findBodyWeightForWorkoutDate([SECOND, FIRST], '2026-07-23')).toBe(
      FIRST,
    )
    expect(
      findBodyWeightForWorkoutDate([SECOND, FIRST], '2026-07-19'),
    ).toBeUndefined()
  })

  it.each([19.99, 500.01, 81.555, Number.NaN])(
    'rejects implausible weight %s',
    (weightKg) => {
      expect(() =>
        upsertBodyWeightEntry(
          [],
          { date: '2026-07-20', weightKg, note: '' },
          '2026-07-20T06:00:00.000Z',
        ),
      ).toThrow('Bitte gib ein plausibles Gewicht')
    },
  )
})
