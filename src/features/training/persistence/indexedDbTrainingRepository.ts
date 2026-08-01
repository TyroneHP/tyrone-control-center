import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { EMPTY_TRAINING_STATE } from '../model/trainingDefaults'
import { trainingStateSchema } from '../model/trainingSchemas'
import type { TrainingState } from '../model/trainingTypes'
import {
  migrateTrainingState,
  TrainingDataCorruptionError,
} from './trainingMigrations'
import type { TrainingRepository } from './trainingRepository'

const DATABASE_NAME = 'coregrid-training'
const DATABASE_VERSION = 2

interface TrainingDb extends DBSchema {
  states: { key: string; value: TrainingState }
  images: { key: string; value: { profileId: string; blob: Blob } }
}

function openTrainingDatabase() {
  return openDB<TrainingDb>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('states')) {
        database.createObjectStore('states')
      }
      if (!database.objectStoreNames.contains('images')) {
        database.createObjectStore('images')
      }
    },
  })
}

function imageKey(profileId: string, imageId: string) {
  return `${profileId}:${imageId}`
}

async function readStoredState(
  database: IDBPDatabase<TrainingDb>,
  profileId: string,
) {
  const transaction = database.transaction('states')
  const store = transaction.objectStore('states')
  const [recordCount, value] = await Promise.all([
    store.count(profileId),
    store.get(profileId),
  ])
  await transaction.done
  return { exists: recordCount > 0, value }
}

async function readStoredImage(
  database: IDBPDatabase<TrainingDb>,
  key: string,
) {
  const transaction = database.transaction('images')
  const store = transaction.objectStore('images')
  const [recordCount, value] = await Promise.all([
    store.count(key),
    store.get(key),
  ])
  await transaction.done
  return { exists: recordCount > 0, value }
}

function isBlob(value: unknown): value is Blob {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Blob
  const tag = Object.prototype.toString.call(value)
  return (
    (tag === '[object Blob]' || tag === '[object File]') &&
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function' &&
    typeof candidate.slice === 'function'
  )
}

function isImageRecord(
  value: unknown,
): value is { profileId: string; blob: Blob } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 2 &&
    typeof record.profileId === 'string' &&
    isBlob(record.blob)
  )
}

export class IndexedDbTrainingRepository implements TrainingRepository {
  private readonly database = openTrainingDatabase()

  async load(profileId: string): Promise<TrainingState> {
    const database = await this.database
    const { exists, value } = await readStoredState(database, profileId)
    if (!exists) return EMPTY_TRAINING_STATE

    try {
      const migrated = migrateTrainingState(value)
      if (
        (value as { schemaVersion?: unknown })?.schemaVersion !== 2 ||
        !trainingStateSchema.safeParse(value).success
      ) {
        await database.put('states', migrated, profileId)
      }
      return migrated
    } catch (error) {
      if (error instanceof TrainingDataCorruptionError) throw error
      throw new TrainingDataCorruptionError(
        'Die gespeicherten Trainingsdaten sind beschädigt.',
        { cause: error },
      )
    }
  }

  async save(profileId: string, state: TrainingState): Promise<void> {
    const database = await this.database
    await database.put('states', state, profileId)
  }

  async saveImage(
    profileId: string,
    imageId: string,
    blob: Blob,
  ): Promise<void> {
    const database = await this.database
    await database.put(
      'images',
      { profileId, blob },
      imageKey(profileId, imageId),
    )
  }

  async loadImage(
    profileId: string,
    imageId: string,
  ): Promise<Blob | undefined> {
    const database = await this.database
    const { exists, value } = await readStoredImage(
      database,
      imageKey(profileId, imageId),
    )
    if (!exists) return undefined
    if (!isImageRecord(value) || value.profileId !== profileId) {
      throw new TrainingDataCorruptionError(
        'Die gespeicherten Trainingsbilder sind beschädigt.',
      )
    }
    return value.blob
  }

  async deleteImage(profileId: string, imageId: string): Promise<void> {
    const database = await this.database
    await database.delete('images', imageKey(profileId, imageId))
  }

  async exportRaw(profileId: string): Promise<string> {
    const database = await this.database
    const { exists, value } = await readStoredState(database, profileId)
    if (!exists) return 'null'
    return JSON.stringify(value, null, 2) ?? 'undefined'
  }

  async reset(profileId: string): Promise<void> {
    const database = await this.database
    const transaction = database.transaction(
      ['states', 'images'],
      'readwrite',
    )
    await transaction.objectStore('states').delete(profileId)

    const imageStore = transaction.objectStore('images')
    const keyPrefix = `${profileId}:`
    let cursor = await imageStore.openCursor()
    while (cursor) {
      if (typeof cursor.key === 'string' && cursor.key.startsWith(keyPrefix)) {
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }

    await transaction.done
  }
}
