import type { BodyWeightEntry } from './trainingTypes'

export interface BodyWeightEntryInput {
  date: string
  weightKg: number
  note?: string
}

export class BodyWeightDateConflictError extends Error {
  override readonly name = 'BodyWeightDateConflictError'

  constructor(readonly date: string) {
    super(`Für den ${date} ist bereits ein Körpergewicht gespeichert.`)
  }
}

function assertValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  const day = Number(match?.[3])
  const date = new Date(year, month - 1, day, 12)
  if (
    !match ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new RangeError('Bitte gib ein gültiges Datum an.')
  }
}

function assertValidWeight(weightKg: number) {
  const scaledWeight = weightKg * 100
  if (
    !Number.isFinite(weightKg) ||
    weightKg < 20 ||
    weightKg > 500 ||
    Math.abs(scaledWeight - Math.round(scaledWeight)) > 1e-8
  ) {
    throw new RangeError(
      'Bitte gib ein plausibles Gewicht zwischen 20 und 500 kg mit höchstens zwei Nachkommastellen an.',
    )
  }
}

function validateInput(input: BodyWeightEntryInput) {
  assertValidDateKey(input.date)
  assertValidWeight(input.weightKg)
}

function sortEntries(entries: BodyWeightEntry[]) {
  return entries.sort((left, right) => left.date.localeCompare(right.date))
}

export function upsertBodyWeightEntry(
  entries: readonly BodyWeightEntry[],
  input: BodyWeightEntryInput,
  timestamp: string,
  createId: () => string = () => crypto.randomUUID(),
): BodyWeightEntry[] {
  validateInput(input)
  const existing = entries.find(({ date }) => date === input.date)
  if (existing) {
    return sortEntries(
      entries.map((entry) =>
        entry === existing
          ? {
              ...entry,
              weightKg: input.weightKg,
              note: input.note ?? '',
              updatedAt: timestamp,
            }
          : entry,
      ),
    )
  }

  return sortEntries([
    ...entries,
    {
      id: createId(),
      date: input.date,
      weightKg: input.weightKg,
      note: input.note ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ])
}

export function moveBodyWeightEntry(
  entries: readonly BodyWeightEntry[],
  entryId: string,
  input: BodyWeightEntryInput,
  timestamp: string,
): BodyWeightEntry[] {
  validateInput(input)
  const existing = entries.find(({ id }) => id === entryId)
  if (!existing) throw new Error('Körpergewichtseintrag wurde nicht gefunden.')
  if (
    entries.some(
      ({ id, date }) => id !== entryId && date === input.date,
    )
  ) {
    throw new BodyWeightDateConflictError(input.date)
  }

  return sortEntries(
    entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            date: input.date,
            weightKg: input.weightKg,
            note: input.note ?? '',
            updatedAt: timestamp,
          }
        : entry,
    ),
  )
}

export function deleteBodyWeightEntry(
  entries: readonly BodyWeightEntry[],
  entryId: string,
) {
  return entries.filter(({ id }) => id !== entryId)
}

export function findBodyWeightForWorkoutDate(
  entries: readonly BodyWeightEntry[],
  workoutDate: string,
) {
  return entries
    .filter(({ date }) => date <= workoutDate)
    .sort((left, right) => right.date.localeCompare(left.date))[0]
}
