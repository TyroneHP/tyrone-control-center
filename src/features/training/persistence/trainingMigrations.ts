import { trainingStateSchema } from '../model/trainingSchemas'
import type { TrainingState } from '../model/trainingTypes'

export class TrainingDataCorruptionError extends Error {
  override readonly name = 'TrainingDataCorruptionError'
}

function migrateV0ToV1(record: { schemaVersion?: unknown }): TrainingState {
  return trainingStateSchema.parse({ ...record, schemaVersion: 1 })
}

export function migrateTrainingState(value: unknown): TrainingState {
  const record = value as { schemaVersion?: unknown }
  if (record?.schemaVersion === 1) return trainingStateSchema.parse(record)
  if (record?.schemaVersion === 0) return migrateV0ToV1(record)
  throw new TrainingDataCorruptionError('Unbekannte Trainingsdaten-Version.')
}
