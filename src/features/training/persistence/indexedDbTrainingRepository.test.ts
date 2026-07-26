import 'fake-indexeddb/auto'

import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { openDB, type DBSchema } from 'idb'
import type { TrainingState } from '../model/trainingTypes'
import { IndexedDbTrainingRepository } from './indexedDbTrainingRepository'
import { TrainingDataCorruptionError } from './trainingMigrations'

const DATABASE_NAME = 'coregrid-training'
const DATABASE_VERSION = 1

interface RawTrainingDb extends DBSchema {
  states: { key: string; value: unknown }
  images: { key: string; value: unknown }
}

const EMPTY_STATE: TrainingState = {
  schemaVersion: 1,
  customExercises: [],
  favoriteExerciseIds: [],
  templates: [],
  activeWorkout: null,
  completedWorkouts: [],
  preferences: {
    showSetRating: true,
    progressionEnabled: true,
    successfulWorkoutCount: 3,
    maximumAverageRating: 8,
    defaultIncrementKg: 2.5,
  },
}

function makeTrainingState(
  favoriteExerciseId: string,
  defaultIncrementKg = 2.5,
): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [favoriteExerciseId],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    preferences: {
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg,
    },
  }
}

function makeCloneableBlob(bytes: number[], type: string): Blob {
  // fake-indexeddb uses Node's structuredClone, which cannot clone jsdom's Blob.
  return new NodeBlob([new Uint8Array(bytes)], { type }) as unknown as Blob
}

function makeCloneableFile(
  bytes: number[],
  name: string,
  type: string,
): File {
  return new NodeFile([new Uint8Array(bytes)], name, {
    type,
    lastModified: 123,
  }) as unknown as File
}

async function openRawTrainingDatabase() {
  return openDB<RawTrainingDb>(DATABASE_NAME, DATABASE_VERSION, {
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

async function putRawState(profileId: string, value: unknown) {
  const database = await openRawTrainingDatabase()
  try {
    await database.put('states', value, profileId)
  } finally {
    database.close()
  }
}

async function readRawState(profileId: string) {
  const database = await openRawTrainingDatabase()
  try {
    return await database.get('states', profileId)
  } finally {
    database.close()
  }
}

async function countRawState(profileId: string) {
  const database = await openRawTrainingDatabase()
  try {
    return await database.count('states', profileId)
  } finally {
    database.close()
  }
}

async function putRawImage(key: string, value: unknown) {
  const database = await openRawTrainingDatabase()
  try {
    await database.put('images', value, key)
  } finally {
    database.close()
  }
}

async function readRawImage(key: string) {
  const database = await openRawTrainingDatabase()
  try {
    return await database.get('images', key)
  } finally {
    database.close()
  }
}

async function readBlobBytes(blob: Blob) {
  return [...new Uint8Array(await blob.arrayBuffer())]
}

describe('IndexedDbTrainingRepository', () => {
  const repository = new IndexedDbTrainingRepository()

  it('creates the version-one states and images stores on first use', async () => {
    await repository.load('schema-profile')

    const database = await openRawTrainingDatabase()
    try {
      expect(database.version).toBe(1)
      expect([...database.objectStoreNames]).toEqual(['images', 'states'])
    } finally {
      database.close()
    }
  })

  it('returns the empty training state for a profile without a record', async () => {
    await expect(repository.load('missing-profile')).resolves.toEqual(
      EMPTY_STATE,
    )
  })

  it('round-trips a complete training state', async () => {
    const state = makeTrainingState('bench-press', 5)

    await repository.save('round-trip-profile', state)

    const loaded = await repository.load('round-trip-profile')
    expect(loaded).toEqual(state)
    expect(loaded).not.toBe(state)
  })

  it('keeps state isolated between profiles', async () => {
    const firstState = makeTrainingState('bench-press')
    const secondState = makeTrainingState('lat-pulldown')

    await repository.save('isolation-profile-a', firstState)
    await repository.save('isolation-profile-b', secondState)

    await expect(repository.load('isolation-profile-a')).resolves.toEqual(
      firstState,
    )
    await expect(repository.load('isolation-profile-b')).resolves.toEqual(
      secondState,
    )
  })

  it('replaces one atomic state record for the same profile', async () => {
    const profileId = 'atomic-profile'
    const replacement = makeTrainingState('squat', 1.5)

    await repository.save(profileId, makeTrainingState('deadlift'))
    await repository.save(profileId, replacement)

    const database = await openRawTrainingDatabase()
    try {
      const matchingKeys = (await database.getAllKeys('states')).filter(
        (key) => key === profileId,
      )
      expect(matchingKeys).toEqual([profileId])
      expect(await database.get('states', profileId)).toEqual(replacement)
    } finally {
      database.close()
    }
  })

  it('scopes image blobs by profile and image ID', async () => {
    const firstBlob = makeCloneableBlob([1, 2, 3], 'image/webp')
    const secondBlob = makeCloneableBlob([4, 5], 'image/png')

    await repository.saveImage('image-profile-a', 'shared-image', firstBlob)
    await repository.saveImage('image-profile-b', 'shared-image', secondBlob)

    const firstLoaded = await repository.loadImage(
      'image-profile-a',
      'shared-image',
    )
    const secondLoaded = await repository.loadImage(
      'image-profile-b',
      'shared-image',
    )
    expect(firstLoaded).toBeInstanceOf(NodeBlob)
    expect(secondLoaded).toBeInstanceOf(NodeBlob)
    expect(firstLoaded).toMatchObject({ size: 3, type: 'image/webp' })
    expect(secondLoaded).toMatchObject({ size: 2, type: 'image/png' })
    expect(await readBlobBytes(firstLoaded!)).toEqual([1, 2, 3])
    expect(await readBlobBytes(secondLoaded!)).toEqual([4, 5])

    const database = await openRawTrainingDatabase()
    try {
      expect(
        await database.get('images', 'image-profile-a:shared-image'),
      ).toMatchObject({ profileId: 'image-profile-a' })
      expect(
        await database.get('images', 'image-profile-b:shared-image'),
      ).toMatchObject({ profileId: 'image-profile-b' })
    } finally {
      database.close()
    }

    await repository.deleteImage('image-profile-a', 'shared-image')
    await expect(
      repository.loadImage('image-profile-a', 'shared-image'),
    ).resolves.toBeUndefined()
    const remaining = await repository.loadImage(
      'image-profile-b',
      'shared-image',
    )
    expect(remaining).toBeInstanceOf(NodeBlob)
    expect(remaining).toMatchObject({ size: 2, type: 'image/png' })
    expect(await readBlobBytes(remaining!)).toEqual([4, 5])
  })

  it('round-trips a File image as a valid Blob subtype', async () => {
    const profileId = 'file-image-profile'
    const imageId = 'uploaded-file'
    const file = makeCloneableFile(
      [10, 20, 30, 40],
      'uploaded-image.webp',
      'image/webp',
    )

    await repository.saveImage(profileId, imageId, file)

    const loaded = (await repository.loadImage(profileId, imageId)) as
      | File
      | undefined
    expect(loaded).toBeInstanceOf(NodeFile)
    expect(loaded?.name).toBe('uploaded-image.webp')
    expect(loaded).toMatchObject({ size: 4, type: 'image/webp' })
    expect(await readBlobBytes(loaded!)).toEqual([10, 20, 30, 40])
  })

  it('rejects an image record whose blob field is corrupt without overwriting it', async () => {
    const profileId = 'corrupt-image-profile'
    const imageId = 'corrupt-blob'
    const key = `${profileId}:${imageId}`
    const corruptRecord = { profileId, blob: 'not-a-blob' }
    await putRawImage(key, corruptRecord)

    await expect(repository.loadImage(profileId, imageId)).rejects.toBeInstanceOf(
      TrainingDataCorruptionError,
    )
    await expect(readRawImage(key)).resolves.toEqual(corruptRecord)
  })

  it('rejects mismatched image profile metadata without exposing or overwriting the blob', async () => {
    const requestedProfileId = 'requested-image-profile'
    const storedProfileId = 'different-image-profile'
    const imageId = 'mismatched-profile'
    const key = `${requestedProfileId}:${imageId}`
    await putRawImage(key, {
      profileId: storedProfileId,
      blob: makeCloneableBlob([9, 8, 7], 'image/webp'),
    })

    await expect(
      repository.loadImage(requestedProfileId, imageId),
    ).rejects.toBeInstanceOf(TrainingDataCorruptionError)

    const preserved = (await readRawImage(key)) as {
      profileId: string
      blob: Blob
    }
    expect(preserved.profileId).toBe(storedProfileId)
    expect(preserved.blob).toBeInstanceOf(NodeBlob)
    expect(await readBlobBytes(preserved.blob)).toEqual([9, 8, 7])
  })

  it('rejects invalid version-one state without overwriting its raw value', async () => {
    const profileId = 'corrupt-profile'
    const corruptState = {
      schemaVersion: 1,
      favoriteExerciseIds: ['bench-press'],
    }
    await putRawState(profileId, corruptState)

    await expect(repository.load(profileId)).rejects.toBeInstanceOf(
      TrainingDataCorruptionError,
    )
    await expect(readRawState(profileId)).resolves.toEqual(corruptState)
  })

  it('rejects a stored undefined state without treating its key as missing', async () => {
    const profileId = 'undefined-state-profile'
    await putRawState(profileId, undefined)

    await expect(repository.load(profileId)).rejects.toBeInstanceOf(
      TrainingDataCorruptionError,
    )
    await expect(countRawState(profileId)).resolves.toBe(1)
  })

  it('rejects an unknown data version with the recovery error message', async () => {
    await putRawState('unknown-version-profile', { schemaVersion: 99 })

    await expect(repository.load('unknown-version-profile')).rejects.toEqual(
      expect.objectContaining({
        name: 'TrainingDataCorruptionError',
        message: 'Unbekannte Trainingsdaten-Version.',
      }),
    )
  })

  it('exports untouched raw JSON even when the state is corrupt', async () => {
    const profileId = 'export-profile'
    const rawState = {
      schemaVersion: 1,
      favoriteExerciseIds: ['bench-press', 'bench-press'],
      recoveryNote: 'keep this exact raw record',
    }
    await putRawState(profileId, rawState)

    const exported = await repository.exportRaw(profileId)

    expect(JSON.parse(exported)).toEqual(rawState)
    await expect(readRawState(profileId)).resolves.toEqual(rawState)
  })

  it('exports stored undefined distinctly from a missing state record', async () => {
    const profileId = 'undefined-export-profile'
    await putRawState(profileId, undefined)

    await expect(repository.exportRaw(profileId)).resolves.toBe('undefined')
    await expect(
      repository.exportRaw('missing-undefined-export-profile'),
    ).resolves.toBe('null')
    await expect(countRawState(profileId)).resolves.toBe(1)
  })

  it('resets only the selected profile state and images', async () => {
    const firstProfile = 'reset-profile-a'
    const secondProfile = 'reset-profile-b'
    const secondState = makeTrainingState('lat-pulldown')
    await repository.save(firstProfile, makeTrainingState('bench-press'))
    await repository.save(secondProfile, secondState)
    await repository.saveImage(
      firstProfile,
      'shared-image',
      makeCloneableBlob([1], 'image/webp'),
    )
    await repository.saveImage(
      secondProfile,
      'shared-image',
      makeCloneableBlob([2, 3], 'image/webp'),
    )

    await repository.reset(firstProfile)

    await expect(repository.load(firstProfile)).resolves.toEqual(EMPTY_STATE)
    await expect(repository.load(secondProfile)).resolves.toEqual(secondState)
    await expect(
      repository.loadImage(firstProfile, 'shared-image'),
    ).resolves.toBeUndefined()
    await expect(
      repository.loadImage(secondProfile, 'shared-image'),
    ).resolves.toMatchObject({ size: 2, type: 'image/webp' })
  })

  it('migrates a version-zero state fixture to version one', async () => {
    const profileId = 'migration-profile'
    await putRawState(profileId, {
      schemaVersion: 0,
      customExercises: [],
      favoriteExerciseIds: ['bench-press'],
      templates: [],
      activeWorkout: null,
      completedWorkouts: [],
      preferences: {
        showSetRating: true,
        progressionEnabled: true,
        successfulWorkoutCount: 3,
        maximumAverageRating: 8,
        defaultIncrementKg: 2.5,
      },
    })

    await expect(repository.load(profileId)).resolves.toEqual({
      schemaVersion: 1,
      customExercises: [],
      favoriteExerciseIds: ['bench-press'],
      templates: [],
      activeWorkout: null,
      completedWorkouts: [],
      preferences: {
        showSetRating: true,
        progressionEnabled: true,
        successfulWorkoutCount: 3,
        maximumAverageRating: 8,
        defaultIncrementKg: 2.5,
      },
    })
  })
})
