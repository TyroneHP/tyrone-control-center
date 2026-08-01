import { expect, test, type Page } from '@playwright/test'
import { installPreviewSession } from './previewSession'

const MEMBER_PROFILE_ID = '22222222-2222-2222-2222-222222222222'

function trainingPath(path = '') {
  const base =
    process.env.E2E_PRODUCTION_PREVIEW === 'true'
      ? '/tyrone-control-center/training'
      : '/training'
  return `${base}${path}`
}

async function seedAnalyticsHistory(page: Page) {
  await page.goto(trainingPath())
  await page.evaluate(async ({ profileId }) => {
    const localDateKey = (daysAgo: number) => {
      const date = new Date()
      date.setHours(12, 0, 0, 0)
      date.setDate(date.getDate() - daysAgo)
      const pad = (value: number) => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    const instant = (daysAgo: number, hour: number) =>
      new Date(`${localDateKey(daysAgo)}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
    const exercise = (
      workoutId: string,
      exerciseId: string,
      name: string,
      primaryMuscles: string[],
      secondaryMuscles: string[],
      unit: 'kg-reps' | 'reps',
      weightKg: number | null,
      reps: number,
      bodyWeightSnapshot?: {
        weightKg: number
        sourceDate: string
        capturedAt: string
      },
    ) => ({
      id: `${workoutId}-${exerciseId}`,
      exerciseId,
      exerciseSnapshot: {
        exerciseId,
        name,
        primaryMuscles,
        secondaryMuscles,
        unit,
        supportsBodyweightModes: exerciseId === 'pull-up',
      },
      order: exerciseId === 'bench-press' ? 0 : 1,
      targetSets: 1,
      repMin: 8,
      repMax: 12,
      loadMode: exerciseId === 'pull-up' ? 'bodyweight' : 'external',
      note: '',
      ...(bodyWeightSnapshot ? { bodyWeightSnapshot } : {}),
      sets: [{
        id: `${workoutId}-${exerciseId}-set`,
        weightKg,
        reps,
        rating: 7,
        completed: true,
      }],
    })
    const bodyWeightDate = localDateKey(8)
    const state = {
      schemaVersion: 2,
      customExercises: [],
      favoriteExerciseIds: ['bench-press'],
      templates: [],
      activeWorkout: null,
      completedWorkouts: [
        {
          id: 'analytics-old',
          name: 'Analyse Alt',
          startedAt: instant(7, 17),
          completedAt: instant(7, 18),
          exercises: [exercise(
            'analytics-old', 'bench-press', 'Bankdrücken',
            ['Brust'], ['Trizeps', 'Vordere Schulter'], 'kg-reps', 50, 8,
          )],
        },
        {
          id: 'analytics-new',
          name: 'Analyse Neu',
          startedAt: instant(1, 17),
          completedAt: instant(1, 18),
          exercises: [
            exercise(
              'analytics-new', 'bench-press', 'Bankdrücken',
              ['Brust'], ['Trizeps', 'Vordere Schulter'], 'kg-reps', 60, 10,
            ),
            exercise(
              'analytics-new', 'pull-up', 'Klimmzug',
              ['Latissimus'], ['Bizeps', 'Mittlerer Rücken'], 'reps', null, 8,
              {
                weightKg: 80,
                sourceDate: bodyWeightDate,
                capturedAt: instant(1, 18),
              },
            ),
          ],
        },
      ],
      bodyWeightEntries: [{
        id: 'analytics-weight-old',
        date: bodyWeightDate,
        weightKg: 80,
        note: 'Ausgangswert',
        createdAt: instant(8, 7),
        updatedAt: instant(8, 7),
      }],
      analyticsPreferences: {
        range: { preset: 'all' },
        exerciseMetric: 'weight',
        muscleMetric: 'sets',
        dismissedBalanceInsightIds: [],
      },
      preferences: {
        showSetRating: true,
        progressionEnabled: true,
        successfulWorkoutCount: 3,
        maximumAverageRating: 8,
        defaultIncrementKg: 2.5,
      },
    }

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('coregrid-training', 2)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('states')) {
          database.createObjectStore('states')
        }
        if (!database.objectStoreNames.contains('images')) {
          database.createObjectStore('images')
        }
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('states', 'readwrite')
        transaction.objectStore('states').put(state, profileId)
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, { profileId: MEMBER_PROFILE_ID })
  await page.reload()
}

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    containers: ['.app-shell__content', '.training-layout', '.training-navigation', '.progress-layout', '.progress-navigation']
      .map((selector) => {
        const element = document.querySelector(selector)
        const rect = element?.getBoundingClientRect()
        return {
          selector,
          clientWidth: element?.clientWidth,
          left: rect?.left,
          right: rect?.right,
          scrollWidth: element?.scrollWidth,
          width: rect?.width,
        }
      }),
    documentWidth: document.documentElement.scrollWidth,
    fits: document.documentElement.scrollWidth <= window.innerWidth,
    offenders: Array.from(document.querySelectorAll('body *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < 0 || rect.right > window.innerWidth
      })
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          className: element.className,
          left: rect.left,
          right: rect.right,
          tagName: element.tagName,
          width: rect.width,
        }
      }),
    viewportWidth: window.innerWidth,
  }))
  expect(layout.fits, JSON.stringify(layout)).toBe(true)
}

test('recalculates local analytics and keeps progress navigation available offline on iPhone', async ({ context, page }, testInfo) => {
  test.setTimeout(60_000)
  test.skip(
    testInfo.project.name !== 'iphone-webkit',
    'Der vollständige Touch- und Offline-Pfad läuft einmal in iPhone WebKit.',
  )
  await installPreviewSession(page, 'member')
  await seedAnalyticsHistory(page)

  await page.goto(trainingPath('/progress'))
  await expect(page.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible()
  await expect(page.getByLabel('Fortschrittskennzahlen')).toContainText('Trainings2')
  await expect(page.getByLabel('Fortschrittskennzahlen')).toContainText('Abgeschlossene Sätze3')
  await expectNoHorizontalOverflow(page)

  await page.getByRole('link', { name: 'Übungsfortschritt öffnen' }).click()
  await page.getByRole('button', { exact: true, name: 'Bankdrücken analysieren' }).click()
  await page.getByLabel('Kennzahl').selectOption('volume')
  await expect(page.getByRole('img', { name: 'Volumenverlauf Bankdrücken' })).toBeVisible()
  await page.getByRole('button', { name: /600 kg/ }).click()
  await expect(page.getByRole('dialog', { name: 'Analyse Neu' })).toContainText('60 kg')
  await page.getByRole('dialog', { name: 'Analyse Neu' })
    .getByRole('button', { exact: true, name: 'Schließen' }).click()

  await page.getByRole('link', { name: 'Rekorde' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Persönliche Rekorde' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Rekorde: Bankdrücken' })).toContainText('60 kg')

  await page.getByRole('link', { name: 'Muskelgruppen' }).click()
  await page.getByLabel('Kennzahl').selectOption('volume')
  await page.getByLabel('Muskelgruppen-Rangliste')
    .getByRole('button', { name: /^Brust/ }).click()
  await expect(page.getByRole('dialog', { name: 'Muskelgruppe Brust' })).toContainText('Bankdrücken')
  await page.getByRole('dialog', { name: 'Muskelgruppe Brust' })
    .getByRole('button', { exact: true, name: 'Schließen' }).click()

  await page.getByRole('link', { name: 'Körpergewicht' }).click()
  await page.getByRole('button', { name: 'Messung hinzufügen' }).click()
  const measurementDialog = page.getByRole('dialog', { name: 'Messung hinzufügen' })
  await measurementDialog.getByLabel('Gewicht in kg').fill('81,2')
  await measurementDialog.getByLabel('Notiz (optional)').fill('E2E-Messung')
  await measurementDialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByLabel('Körpergewichtsmessungen').getByText('E2E-Messung')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Körpergewichtsmessungen').getByText('E2E-Messung')).toBeVisible()

  await page.goto(trainingPath('/history/analytics-new'))
  const pullUpDetails = page.getByRole('region', { name: 'Klimmzug' })
  await expect(pullUpDetails.getByText(/Verwendetes Körpergewicht: 80 kg/)).toBeVisible()
  await expect(pullUpDetails.getByRole('cell', { exact: true, name: '80 kg' })).toBeVisible()
  await page.getByRole('button', { name: 'Training bearbeiten' }).click()
  const benchEditor = page.getByRole('group', { name: 'Bankdrücken bearbeiten' })
  await benchEditor.getByLabel('Satz 1 Gewicht').fill('70')
  await page.getByRole('button', { name: 'Änderungen speichern' }).click()

  await page.goto(trainingPath('/progress/exercises?exercise=bench-press'))
  await page.getByLabel('Kennzahl').selectOption('volume')
  await expect(page.getByRole('button', { name: /700 kg/ })).toBeVisible()

  await page.goto(trainingPath('/history/analytics-new'))
  await page.getByRole('button', { name: 'Training löschen' }).click()
  await page.getByRole('dialog', { name: 'Training wirklich löschen?' })
    .getByRole('button', { name: 'Endgültig löschen' }).click()
  await page.goto(trainingPath('/progress/records'))
  await expect(page.getByRole('article', { name: 'Rekorde: Bankdrücken' })).toContainText('50 kg')

  await page.goto(trainingPath('/progress'))
  await context.setOffline(true)
  await page.getByRole('link', { name: 'Übungen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Übungsfortschritt' })).toBeVisible()
  await page.getByRole('link', { name: 'Körpergewicht' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Körpergewicht' })).toBeVisible()
  await expect(page.getByLabel('Körpergewichtsmessungen').getByText('E2E-Messung')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
