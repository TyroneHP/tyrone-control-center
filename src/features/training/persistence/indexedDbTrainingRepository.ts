import { openDB, type DBSchema } from 'idb'
import { EMPTY_TRAINING_STATE } from '../model/trainingDefaults'
import type { TrainingState } from '../model/trainingTypes'
import {
  migrateTrainingState,
  TrainingDataCorruptionError,
} from './trainingMigrations'
import type { TrainingRepository } from './trainingRepository'

const DATABASE_NAME = 'coregrid-training'
const DATABASE_VERSION = 1

interface TrainingDb extends DBSchema {
  states: { key: string; value: TrainingState }
  images: { key: string; value: { profileId: string; blob: Blob } }
}

function openTrainingDatabase() {
  return openDB<TrainingDb>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      database.createObjectStore('states')
      database.createObjectStore('images')
    },
  })
}

function imageKey(profileId: string, imageId: string) {
  return `${profileId}:${imageId}`
}

export class IndexedDbTrainingRepository implements TrainingRepository {
  private readonly database = openTrainingDatabase()

  async load(profileId: string): Promise<TrainingState> {
    const database = await this.database
    const value = await database.get('states', profileId)
    if (value === undefined) return EMPTY_TRAINING_STATE

    try {
      return migrateTrainingState(value)
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
    const value = await database.get('images', imageKey(profileId, imageId))
    return value?.profileId === profileId ? value.blob : undefined
  }

  async deleteImage(profileId: string, imageId: string): Promise<void> {
    const database = await this.database
    await database.delete('images', imageKey(profileId, imageId))
  }

  async exportRaw(profileId: string): Promise<string> {
    const database = await this.database
    const value = await database.get('states', profileId)
    return JSON.stringify(value ?? null, null, 2)
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
