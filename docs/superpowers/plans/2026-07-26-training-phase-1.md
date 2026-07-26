# Training Phase 1 Implementation Plan

> **Für agentische Worker:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Ziel:** Den bisherigen Platzhalter unter `/training` durch einen mobile-first, vollständig offline nutzbaren Trainingsbereich mit 50 Standardübungen, eigenen Übungen, Trainingsplänen, genau einem aktiven Training, Verlauf und konfigurierbaren Steigerungsempfehlungen ersetzen.

**Architektur:** Die 50 Standardübungen und ihre technischen SVG-Illustrationen werden statisch mit der PWA ausgeliefert. Veränderliche Trainingsdaten werden profilbezogen in IndexedDB gespeichert und über ein klar abgegrenztes `TrainingRepository` sowie einen `TrainingProvider` verwaltet; Zod validiert jeden gelesenen Datensatz. Die Benutzeroberfläche besteht aus verschachtelten Training-Routen und verwendet das vorhandene Design-System, `ResponsiveDialog`, Toasts und die bestehende mobile Navigation.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Zod 4, `idb`, IndexedDB, `@dnd-kit`, Vite PWA/Workbox, Vitest, Testing Library, fake-indexeddb, Playwright.

## Globale Einschränkungen

- Alle Trainingsdaten bleiben in Phase 1 ausschließlich lokal auf dem jeweiligen Gerät.
- Keine Supabase-Tabellen, Migrationen, Edge Functions, API-Aufrufe oder Synchronisierung ergänzen.
- Keine Push-Benachrichtigungen, Erinnerungszeiten oder Hintergrundjobs ergänzen.
- Wochentage dienen ausschließlich der Anzeige `Heute geplant`.
- Es darf pro Profil immer nur genau ein aktives Training geben.
- Neue Planübungen verwenden standardmäßig `3 × 8–12`.
- Satzbewertungen liegen zwischen 1 und 10 und sind global deaktivierbar.
- Standardwerte der Steigerungsregel: 3 erfolgreiche Trainings, Bewertungsgrenze 8, Erhöhung 2,5 kg.
- Keine Pausentimer, Aufwärmsatz-Markierung, Körpergewichtsverwaltung, Gesamtlast, Diagramme, Volumenanalyse, Muskelgruppenanalyse oder KI-Trainingsplanung.
- Mobile-first, große Touch-Ziele, sichtbare Labels und numerische Eingabetastatur für Gewicht und Wiederholungen.
- Sortieren muss per Drag-and-drop und zusätzlich per Schaltflächen möglich sein.
- Haupt- und Nebenmuskeln werden textlich gekennzeichnet; Farbe allein darf nicht die Bedeutung tragen.
- Bestehende Authentifizierung, Kalender, Navigation, Einstellungen und Supabase-Sicherheitsbasis dürfen nicht beschädigt werden.
- Kein direkter Commit auf `main`; Umsetzung auf einem eigenen Feature-Branch und Abschluss über Pull Request.

---

## Geplante Dateistruktur

```text
src/features/training/
├── TrainingProvider.tsx                 # Profilbezogener Zustand und öffentliche Aktionen
├── trainingContext.ts                   # Context-Vertrag
├── useTraining.ts                       # Context-Hook
├── model/
│   ├── trainingTypes.ts                 # Domänentypen und Konstanten
│   ├── trainingSchemas.ts               # Zod-Schemas für persistierte Daten
│   ├── activeWorkoutReducer.ts           # Reine Änderungen am laufenden Training
│   ├── activeWorkoutReducer.test.ts
│   ├── workoutPrefill.ts                 # Letzte Werte, Notiz, Griff und Belastungsmodus
│   ├── workoutPrefill.test.ts
│   ├── progression.ts                   # Steigerungsregel
│   └── progression.test.ts
├── storage/
│   ├── trainingDb.ts                    # IndexedDB-Schema und Öffnen der DB
│   ├── trainingRepository.ts            # Produktives Repository und Transaktionen
│   ├── trainingRepository.test.ts
│   ├── memoryTrainingRepository.ts       # Deterministische Testspeicherung
│   └── imageCompression.ts              # Lokale Bildverkleinerung
├── exercises/
│   ├── standardExercises.ts             # Exakte 50er-Bibliothek
│   ├── standardExercises.test.ts
│   ├── ExerciseIllustration.tsx
│   ├── ExerciseCard.tsx
│   ├── ExerciseDetailDialog.tsx
│   ├── CustomExerciseDialog.tsx
│   └── exerciseFilters.ts
├── templates/
│   ├── WorkoutTemplateEditorPage.tsx
│   ├── WorkoutTemplateForm.tsx
│   └── WorkoutTemplateEditorPage.test.tsx
├── active/
│   ├── ActiveWorkoutPage.tsx
│   ├── ActiveExerciseCard.tsx
│   ├── WorkoutSetRow.tsx
│   ├── ActiveWorkoutConflictDialog.tsx
│   └── ActiveWorkoutPage.test.tsx
├── history/
│   ├── WorkoutHistoryPage.tsx
│   ├── WorkoutHistoryDetailPage.tsx
│   └── WorkoutHistoryPage.test.tsx
├── settings/
│   ├── TrainingSettings.tsx
│   └── TrainingSettings.test.tsx
├── TrainingHomePage.tsx
├── ExerciseLibraryPage.tsx
├── TrainingRecoveryPanel.tsx
├── training.css
└── test/trainingFixtures.ts
public/exercises/
├── fallback.svg
└── <50 technische SVG-Dateien>
tests/e2e/training.spec.ts
```

Bestehende Dateien, die gezielt geändert werden:

- `package.json` und `package-lock.json`: `idb`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fake-indexeddb`.
- `src/routes/router.tsx`: verschachtelte Training-Routen statt Platzhalter.
- `src/routes/ProtectedShell.tsx`: `TrainingProvider` um `AppShell` und `Outlet` legen.
- `src/features/settings/SettingsPage.tsx`: `TrainingSettings` ergänzen.
- `src/pwa/pwaConfig.ts`: Offline-Asset-Test absichern; SVG-Glob bleibt erhalten.
- `README.md`: lokalen Trainingsbereich und Offline-Verhalten dokumentieren.

---

### Task 1: Domänenmodell, Laufzeitvalidierung und Abhängigkeiten

**Dateien:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/training/model/trainingTypes.ts`
- Create: `src/features/training/model/trainingSchemas.ts`
- Create: `src/features/training/model/trainingSchemas.test.ts`

**Interfaces:**
- Produces: `ExerciseDefinition`, `WorkoutTemplate`, `ActiveWorkout`, `CompletedWorkout`, `TrainingPreferences`, `TrainingProfileData`, `LoadMode`, `Weekday`, `CURRENT_TRAINING_SCHEMA_VERSION`.
- Consumes: keine Training-Interfaces aus späteren Tasks.

- [ ] **Step 1: Feature-Abhängigkeiten installieren**

```bash
npm install idb @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install --save-dev fake-indexeddb
```

Erwartung: `package.json` und `package-lock.json` ändern sich; keine anderen Dateien.

- [ ] **Step 2: Zuerst fehlschlagende Schema-Tests schreiben**

```ts
import { describe, expect, it } from 'vitest'
import {
  activeWorkoutSchema,
  trainingPreferencesSchema,
  workoutTemplateSchema,
} from './trainingSchemas'

it('accepts the default 3 x 8-12 template exercise', () => {
  expect(
    workoutTemplateSchema.parse({
      schemaVersion: 1,
      id: 'template-1',
      ownerProfileId: 'profile-1',
      name: 'Oberkörper',
      weekdays: ['monday', 'thursday'],
      exercises: [{ exerciseId: 'bench-press', order: 0, targetSets: 3, repMin: 8, repMax: 12 }],
      createdAt: '2026-07-26T18:00:00.000Z',
      updatedAt: '2026-07-26T18:00:00.000Z',
    }),
  ).toBeDefined()
})

it('rejects a second-rate value outside 1-10', () => {
  const parsed = activeWorkoutSchema.safeParse({
    schemaVersion: 1,
    profileId: 'profile-1',
    id: 'active-1',
    templateId: null,
    name: 'Freies Training',
    startedAt: '2026-07-26T18:00:00.000Z',
    exercises: [{
      id: 'entry-1',
      exerciseId: 'bench-press',
      exerciseSnapshot: { name: 'Bankdrücken', primaryMuscle: 'chest', equipment: 'barbell' },
      order: 0,
      targetSets: 1,
      repMin: 8,
      repMax: 12,
      gripVariant: null,
      loadMode: 'weight',
      note: '',
      sets: [{ id: 'set-1', order: 0, load: 80, repetitions: 10, rating: 11, completed: true }],
    }],
  })
  expect(parsed.success).toBe(false)
})

it('supplies the agreed training preference defaults', () => {
  expect(trainingPreferencesSchema.parse({ schemaVersion: 1, profileId: 'profile-1' })).toMatchObject({
    showSetRating: true,
    progressionEnabled: true,
    progressionSuccessfulWorkouts: 3,
    progressionMaxAverageRating: 8,
    progressionIncrementKg: 2.5,
    favoriteExerciseIds: [],
  })
})
```

- [ ] **Step 3: Test ausführen und erwartetes Fehlschlagen bestätigen**

```bash
npm run test -- src/features/training/model/trainingSchemas.test.ts
```

Erwartung: FAIL, weil Typen und Schemas noch fehlen.

- [ ] **Step 4: Domänentypen mit exakt diesen Kernfeldern implementieren**

```ts
export const CURRENT_TRAINING_SCHEMA_VERSION = 1 as const
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type MuscleGroup = 'chest' | 'back' | 'quadriceps' | 'hamstrings' | 'glutes' | 'calves' | 'shoulders' | 'biceps' | 'triceps' | 'core'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
export type LoadMode = 'weight' | 'bodyweight' | 'added-weight' | 'assisted-weight'

export interface ExerciseDefinition {
  id: string
  source: 'standard' | 'custom'
  ownerProfileId: string | null
  name: string
  primaryMuscle: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  equipment: Equipment
  description: string
  gripVariants: string[]
  supportsBodyweightModes: boolean
  illustrationPath: string | null
  customImageId: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface WorkoutTemplateExercise {
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
}

export interface WorkoutTemplate {
  schemaVersion: 1
  id: string
  ownerProfileId: string
  name: string
  weekdays: Weekday[]
  exercises: WorkoutTemplateExercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutSetEntry {
  id: string
  order: number
  load: number | null
  repetitions: number | null
  rating: number | null
  completed: boolean
}

export interface ExerciseSnapshot {
  name: string
  primaryMuscle: MuscleGroup
  equipment: Equipment
}

export interface WorkoutExerciseEntry {
  id: string
  exerciseId: string
  exerciseSnapshot: ExerciseSnapshot
  order: number
  targetSets: number
  repMin: number
  repMax: number
  gripVariant: string | null
  loadMode: LoadMode
  note: string
  sets: WorkoutSetEntry[]
}

export interface ActiveWorkout {
  schemaVersion: 1
  profileId: string
  id: string
  templateId: string | null
  name: string
  startedAt: string
  exercises: WorkoutExerciseEntry[]
}

export interface CompletedWorkout extends Omit<ActiveWorkout, 'profileId'> {
  ownerProfileId: string
  endedAt: string
  updatedAt: string
}

export interface TrainingPreferences {
  schemaVersion: 1
  profileId: string
  showSetRating: boolean
  progressionEnabled: boolean
  progressionSuccessfulWorkouts: number
  progressionMaxAverageRating: number
  progressionIncrementKg: number
  favoriteExerciseIds: string[]
}
```

Zusätzlich `TrainingProfileData` als aggregierten Ladezustand mit `customExercises`, `templates`, `activeWorkout`, `completedWorkouts`, `preferences` und optionalem `recoveryError` definieren.

- [ ] **Step 5: Strikte Zod-Schemas implementieren**

Jedes persistierte Top-Level-Objekt erhält `schemaVersion: 1`. Zahlenregeln:

```ts
const positiveInteger = z.number().int().min(1)
const nonNegativeNumber = z.number().finite().min(0)
const ratingSchema = z.number().int().min(1).max(10).nullable()
```

`targetSets` liegt bei 1–20, `repMin`/`repMax` bei 1–100 und `repMax >= repMin`. `progressionSuccessfulWorkouts` liegt bei 2–5, Bewertungsgrenze bei 1–10, Erhöhung bei 0,5–25 kg. Schemas sind `.strict()`. Fehlende Preference-Felder erhalten die vereinbarten Defaults.

- [ ] **Step 6: Tests und Typprüfung ausführen**

```bash
npm run test -- src/features/training/model/trainingSchemas.test.ts
npm run typecheck
```

Erwartung: PASS.

- [ ] **Step 7: Commit erstellen**

```bash
git add package.json package-lock.json src/features/training/model
git commit -m "feat(training): add local training domain model"
```

---

### Task 2: IndexedDB-Repository, atomare Transaktionen und Recovery

**Dateien:**
- Create: `src/features/training/storage/trainingDb.ts`
- Create: `src/features/training/storage/trainingRepository.ts`
- Create: `src/features/training/storage/trainingRepository.test.ts`
- Create: `src/features/training/storage/memoryTrainingRepository.ts`

**Interfaces:**
- Consumes: alle Typen und Schemas aus Task 1.
- Produces: `TrainingRepository`, `createIndexedDbTrainingRepository()`, `createMemoryTrainingRepository()`, `ActiveWorkoutExistsError`, `TrainingDataCorruptionError`.

- [ ] **Step 1: Repository-Vertrag und fehlschlagende Transaktionstests schreiben**

```ts
export interface TrainingRepository {
  loadProfile(profileId: string): Promise<TrainingProfileData>
  putCustomExercise(exercise: ExerciseDefinition): Promise<void>
  putExerciseImage(image: StoredExerciseImage): Promise<void>
  getExerciseImage(imageId: string): Promise<Blob | null>
  putTemplate(template: WorkoutTemplate): Promise<void>
  deleteTemplate(profileId: string, templateId: string): Promise<void>
  startWorkout(workout: ActiveWorkout): Promise<void>
  putActiveWorkout(workout: ActiveWorkout): Promise<void>
  completeWorkout(profileId: string, workout: CompletedWorkout): Promise<void>
  discardActiveWorkout(profileId: string): Promise<void>
  putCompletedWorkout(workout: CompletedWorkout): Promise<void>
  deleteCompletedWorkout(profileId: string, workoutId: string): Promise<void>
  putPreferences(preferences: TrainingPreferences): Promise<void>
  exportProfile(profileId: string): Promise<Blob>
  resetProfile(profileId: string): Promise<void>
}
```

Tests mit `fake-indexeddb/auto`:

```ts
it('enforces one active workout per profile', async () => {
  const repository = createIndexedDbTrainingRepository(uniqueDbName())
  await repository.startWorkout(activeWorkout({ id: 'first' }))
  await expect(repository.startWorkout(activeWorkout({ id: 'second' }))).rejects.toBeInstanceOf(ActiveWorkoutExistsError)
})

it('moves an active workout to history in one transaction', async () => {
  const repository = createIndexedDbTrainingRepository(uniqueDbName())
  await repository.startWorkout(activeWorkout({ id: 'active-1' }))
  await repository.completeWorkout('profile-1', completedWorkout({ id: 'active-1' }))
  const loaded = await repository.loadProfile('profile-1')
  expect(loaded.activeWorkout).toBeNull()
  expect(loaded.completedWorkouts.map(({ id }) => id)).toEqual(['active-1'])
})

it('does not overwrite a malformed record and exposes recovery', async () => {
  // Insert malformed raw data directly, then verify TrainingDataCorruptionError/recoveryError.
})
```

- [ ] **Step 2: Tests ausführen und Fehlschlagen bestätigen**

```bash
npm run test -- src/features/training/storage/trainingRepository.test.ts
```

- [ ] **Step 3: IndexedDB-Schema implementieren**

Stores und Schlüssel:

```ts
interface TrainingDbSchema extends DBSchema {
  customExercises: { key: string; value: ExerciseDefinition; indexes: { 'by-profile': string } }
  exerciseImages: { key: string; value: StoredExerciseImage; indexes: { 'by-profile': string } }
  templates: { key: string; value: WorkoutTemplate; indexes: { 'by-profile': string } }
  activeWorkouts: { key: string; value: ActiveWorkout }
  completedWorkouts: {
    key: string
    value: CompletedWorkout
    indexes: { 'by-profile': string; 'by-profile-ended-at': [string, string] }
  }
  preferences: { key: string; value: TrainingPreferences }
  meta: { key: string; value: { key: string; schemaVersion: number } }
}
```

`activeWorkouts` verwendet `profileId` als Key. `openDB` erstellt alle Stores und Indizes ausschließlich in Upgrade-Callbacks. DB-Standardname: `coregrid-training-v1`.

- [ ] **Step 4: Produktives Repository implementieren**

Regeln:

- Jeder Lesevorgang validiert mit den Task-1-Schemas.
- `loadProfile` sortiert Templates nach Name und Verlauf nach `endedAt` absteigend.
- `startWorkout` prüft in einer `readwrite`-Transaktion, dass der Profil-Key noch nicht existiert.
- `completeWorkout` schreibt Verlauf und löscht aktives Training in derselben Transaktion.
- Bearbeiten ersetzt gezielt den vorhandenen Verlaufseintrag; Löschen entfernt nur den Profil-eigenen Eintrag.
- `resetProfile` löscht ausschließlich Datensätze des angegebenen Profils und zugehörige Bild-Blobs.
- `exportProfile` erzeugt `application/json` mit Schema-Version und allen lesbaren Rohdatensätzen; es funktioniert auch im Recovery-Modus.
- Unbekannte zukünftige Schema-Versionen werden nie still migriert oder überschrieben.

- [ ] **Step 5: Memory-Repository mit identischem Vertrag implementieren**

Es nutzt Maps, klont Werte über `structuredClone`, erzwingt dieselbe Ein-Training-Regel und wird in Komponenten-Tests injiziert. Keine separate vereinfachte Semantik.

- [ ] **Step 6: Repository-Tests ausführen**

```bash
npm run test -- src/features/training/storage/trainingRepository.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit erstellen**

```bash
git add src/features/training/storage
git commit -m "feat(training): add indexeddb repository"
```

---

### Task 3: Exakte 50er-Übungsbibliothek und technische SVG-Illustrationen

**Dateien:**
- Create: `src/features/training/exercises/standardExercises.ts`
- Create: `src/features/training/exercises/standardExercises.test.ts`
- Create: `src/features/training/exercises/ExerciseIllustration.tsx`
- Create: `public/exercises/fallback.svg`
- Create: `public/exercises/*.svg` für alle 50 IDs

**Interfaces:**
- Consumes: `ExerciseDefinition`, `MuscleGroup`, `Equipment`.
- Produces: `STANDARD_EXERCISES`, `getStandardExercise(id)`, `ExerciseIllustration`.

- [ ] **Step 1: Inventar-Test vor den Daten schreiben**

```ts
it('ships exactly 50 unique standard exercises with existing illustrations', () => {
  expect(STANDARD_EXERCISES).toHaveLength(50)
  expect(new Set(STANDARD_EXERCISES.map(({ id }) => id)).size).toBe(50)
  for (const exercise of STANDARD_EXERCISES) {
    expect(exercise.source).toBe('standard')
    expect(exercise.ownerProfileId).toBeNull()
    expect(exercise.illustrationPath).toBe(`exercises/${exercise.id}.svg`)
  }
})

it.each([
  'bench-press', 'incline-bench-press', 'leg-press', 'squat', 'romanian-deadlift',
  'deadlift', 'barbell-curl', 'lat-pulldown', 't-bar-row', 'seated-cable-row',
  'katana-triceps-extension', 'leg-extension', 'seated-leg-curl', 'dips',
  'pull-ups', 'preacher-curl',
])('contains required exercise %s', (id) => {
  expect(STANDARD_EXERCISES.some((exercise) => exercise.id === id)).toBe(true)
})
```

- [ ] **Step 2: Genau dieses 50er-Inventar anlegen**

| Nr. | ID | Deutscher Name | Hauptmuskel | Equipment |
|---:|---|---|---|---|
| 1 | `bench-press` | Bankdrücken | Brust | Langhantel |
| 2 | `incline-bench-press` | Schrägbankdrücken | Brust | Langhantel |
| 3 | `dumbbell-bench-press` | Kurzhantel-Bankdrücken | Brust | Kurzhantel |
| 4 | `incline-dumbbell-press` | Kurzhantel-Schrägbankdrücken | Brust | Kurzhantel |
| 5 | `machine-chest-press` | Brustpresse | Brust | Maschine |
| 6 | `pec-deck` | Butterfly / Pec Deck | Brust | Maschine |
| 7 | `cable-fly` | Kabel-Flys | Brust | Kabelzug |
| 8 | `lat-pulldown` | Latziehen zur Brust | Rücken | Kabelzug |
| 9 | `pull-ups` | Klimmzüge | Rücken | Eigengewicht |
| 10 | `t-bar-row` | T-Bar Row | Rücken | Langhantel |
| 11 | `seated-cable-row` | Sitzendes Kabelrudern | Rücken | Kabelzug |
| 12 | `chest-supported-row` | Brustgestütztes Rudern | Rücken | Maschine |
| 13 | `barbell-row` | Langhantelrudern | Rücken | Langhantel |
| 14 | `one-arm-dumbbell-row` | Einarmiges Kurzhantelrudern | Rücken | Kurzhantel |
| 15 | `straight-arm-pulldown` | Gerade Armzüge am Kabel | Rücken | Kabelzug |
| 16 | `face-pull` | Face Pulls | Schultern | Kabelzug |
| 17 | `squat` | Kniebeugen | Quadrizeps | Langhantel |
| 18 | `leg-press` | Beinpresse | Quadrizeps | Maschine |
| 19 | `romanian-deadlift` | Romanian Deadlifts | Beinbeuger | Langhantel |
| 20 | `deadlift` | Kreuzheben | Rücken | Langhantel |
| 21 | `hack-squat` | Hack Squats | Quadrizeps | Maschine |
| 22 | `bulgarian-split-squat` | Bulgarian Split Squats | Quadrizeps | Kurzhantel |
| 23 | `lunges` | Ausfallschritte | Quadrizeps | Kurzhantel |
| 24 | `leg-extension` | Beinstrecker | Quadrizeps | Maschine |
| 25 | `seated-leg-curl` | Sitzender Beinbeuger | Beinbeuger | Maschine |
| 26 | `lying-leg-curl` | Liegender Beinbeuger | Beinbeuger | Maschine |
| 27 | `hip-thrust` | Hip Thrusts | Gesäß | Langhantel |
| 28 | `standing-calf-raise` | Stehendes Wadenheben | Waden | Maschine |
| 29 | `seated-calf-raise` | Sitzendes Wadenheben | Waden | Maschine |
| 30 | `machine-shoulder-press` | Schulterdrücken an der Maschine | Schultern | Maschine |
| 31 | `dumbbell-shoulder-press` | Kurzhantel-Schulterdrücken | Schultern | Kurzhantel |
| 32 | `dumbbell-lateral-raise` | Seitheben mit Kurzhanteln | Schultern | Kurzhantel |
| 33 | `cable-lateral-raise` | Seitheben am Kabelzug | Schultern | Kabelzug |
| 34 | `reverse-pec-deck` | Reverse Butterfly | Schultern | Maschine |
| 35 | `rear-delt-cable-fly` | Kabel-Flys für hintere Schulter | Schultern | Kabelzug |
| 36 | `front-raise` | Frontheben | Schultern | Kurzhantel |
| 37 | `barbell-curl` | Bizeps-Curls mit Langhantel | Bizeps | Langhantel |
| 38 | `dumbbell-curl` | Bizeps-Curls mit Kurzhanteln | Bizeps | Kurzhantel |
| 39 | `hammer-curl` | Hammer Curls | Bizeps | Kurzhantel |
| 40 | `preacher-curl` | Preacher Curls / Scott-Curls | Bizeps | Maschine |
| 41 | `cable-curl` | Bizeps-Curls am Kabelzug | Bizeps | Kabelzug |
| 42 | `rope-triceps-pushdown` | Trizepsdrücken mit Seil | Trizeps | Kabelzug |
| 43 | `katana-triceps-extension` | Katana Triceps Extension | Trizeps | Kabelzug |
| 44 | `overhead-cable-triceps-extension` | Überkopf-Trizepsstrecken am Kabel | Trizeps | Kabelzug |
| 45 | `dips` | Dips | Trizeps | Eigengewicht |
| 46 | `abdominal-crunch-machine` | Bauchpresse / Crunch-Maschine | Rumpf | Maschine |
| 47 | `cable-crunch` | Cable Crunches | Rumpf | Kabelzug |
| 48 | `hanging-leg-raise` | Hängendes Beinheben | Rumpf | Eigengewicht |
| 49 | `plank` | Plank | Rumpf | Eigengewicht |
| 50 | `glute-kickback` | Glute Kickbacks am Kabel | Gesäß | Kabelzug |

Griffvarianten:

- `lat-pulldown`: Breit, Eng, Neutral, Untergriff.
- `seated-cable-row`: Enger Parallelgriff, Breit, Neutral, Einarmig.
- Weitere Übungen nur mit Varianten, wenn die Variante die Wiedererkennung des letzten Trainings verbessert.
- `pull-ups` und `dips`: `supportsBodyweightModes: true`.

- [ ] **Step 3: Technische SVG-Regeln umsetzen**

Jede SVG-Datei muss:

- eigenes, markenfreies Line-Art-Gerät beziehungsweise Übungssetup zeigen,
- Start- und Endposition durch zwei Figuren oder überlagerte Positionen zeigen,
- mindestens einen Bewegungsrichtungspfeil enthalten,
- eine beschriftete Muskel-Miniatur enthalten,
- Hauptmuskel mit `#f59e0b` und Nebenmuskel mit derselben Farbe bei geringerer Deckkraft zeigen,
- im `viewBox="0 0 800 520"` liegen,
- ohne externe Fonts, Rasterbilder oder Remote-URLs funktionieren,
- einen `<title>` mit deutschem Übungsnamen enthalten.

Keine 50 Kopien derselben generischen Grafik. Gemeinsame SVG-Symbole dürfen wiederverwendet werden, das sichtbare Setup und die Bewegung müssen jedoch zur Übung passen.

- [ ] **Step 4: `ExerciseIllustration` implementieren**

```tsx
export function ExerciseIllustration({ exercise, size = 'card' }: Props) {
  const src = exercise.customImageId
    ? null
    : `${import.meta.env.BASE_URL}${exercise.illustrationPath ?? 'exercises/fallback.svg'}`
  return (
    <figure className={`exercise-illustration exercise-illustration--${size}`}>
      {src ? <img alt={`${exercise.name}: technische Übungsdarstellung`} loading="lazy" src={src} /> : <CustomExerciseImage exercise={exercise} />}
      <figcaption>
        <span>Hauptmuskel: {muscleLabel(exercise.primaryMuscle)}</span>
        {exercise.secondaryMuscles.length > 0 ? <span>Nebenmuskeln: {exercise.secondaryMuscles.map(muscleLabel).join(', ')}</span> : null}
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 5: Katalog- und Asset-Prüfung ausführen**

Zusätzlich zu Vitest ein Node-Testskript verwenden, das alle 50 referenzierten Dateien unter `public/exercises/` prüft und Remote-URLs verbietet.

```bash
npm run test -- src/features/training/exercises/standardExercises.test.ts
npm run build
```

- [ ] **Step 6: Commit erstellen**

```bash
git add src/features/training/exercises public/exercises
git commit -m "feat(training): add exercise catalog and illustrations"
```

---

### Task 4: Übungsbibliothek, Suche, Filter, Favoriten und eigene Übungen

**Dateien:**
- Create: `src/features/training/exercises/exerciseFilters.ts`
- Create: `src/features/training/exercises/ExerciseCard.tsx`
- Create: `src/features/training/exercises/ExerciseDetailDialog.tsx`
- Create: `src/features/training/exercises/CustomExerciseDialog.tsx`
- Create: `src/features/training/storage/imageCompression.ts`
- Create: `src/features/training/ExerciseLibraryPage.tsx`
- Create: `src/features/training/ExerciseLibraryPage.test.tsx`

**Interfaces:**
- Consumes: Katalog, Repository, Preferences.
- Produces: Bibliothek-Seite sowie `compressExerciseImage(file): Promise<Blob>`.

- [ ] **Step 1: Fehlschlagende Komponenten-Tests schreiben**

Tests müssen belegen:

```ts
it('finds Sitzendes Kabelrudern by name and filters to cable back exercises', async () => { /* Suche + Muskel + Equipment */ })
it('toggles a favorite and preserves it after rerender from repository state', async () => { /* Stern-Schaltfläche */ })
it('creates a custom exercise without requiring a photo', async () => { /* Name, Muskel, Equipment, Einheit */ })
it('opens a detail dialog with primary and secondary muscle labels', async () => { /* keine reine Farbcodierung */ })
```

- [ ] **Step 2: Reine Filterfunktion implementieren**

```ts
export function filterExercises(
  exercises: ExerciseDefinition[],
  filters: { query: string; muscle: MuscleGroup | 'all'; equipment: Equipment | 'all'; favoritesOnly: boolean },
  favoriteIds: ReadonlySet<string>,
) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('de-DE')
  return exercises.filter((exercise) =>
    (!normalizedQuery || exercise.name.toLocaleLowerCase('de-DE').includes(normalizedQuery)) &&
    (filters.muscle === 'all' || exercise.primaryMuscle === filters.muscle || exercise.secondaryMuscles.includes(filters.muscle)) &&
    (filters.equipment === 'all' || exercise.equipment === filters.equipment) &&
    (!filters.favoritesOnly || favoriteIds.has(exercise.id)),
  )
}
```

- [ ] **Step 3: Bibliotheks-UI implementieren**

- Suchfeld mit sichtbarem Label.
- Muskel- und Equipment-Select.
- Favoriten-Umschalter.
- responsive Karten mit Illustration, Name, Hauptmuskel und Equipment.
- Favoriten-Schaltfläche mit zugänglichem Namen `Zu Favoriten hinzufügen`/`Aus Favoriten entfernen`.
- Detaildialog mit größerer Illustration, Haupt-/Nebenmuskeltext, Beschreibung, Varianten und `Zum Trainingsplan hinzufügen`, wenn ein Auswahlkontext vorhanden ist.

- [ ] **Step 4: Eigene Übung implementieren**

Formfelder: Name, Hauptmuskel, optionale Nebenmuskeln, Equipment, Einheit (`kg`, `Wiederholungen`, `Zeit`, `Distanz`), Beschreibung und optionales Bild. Ohne Bild wird `fallback.svg` verwendet.

Bildregeln:

```ts
export const CUSTOM_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024
export const CUSTOM_IMAGE_MAX_DIMENSION = 1280
export const CUSTOM_IMAGE_WEBP_QUALITY = 0.82
```

Bild lokal als WebP verkleinern, EXIF/Dateiname nicht persistieren, Blob in `exerciseImages` speichern. Bei nicht unterstütztem Canvas oder fehlerhafter Datei verständliche Meldung zeigen und Erstellung ohne Bild erlauben.

- [ ] **Step 5: Tests ausführen**

```bash
npm run test -- src/features/training/ExerciseLibraryPage.test.tsx
npm run typecheck
```

- [ ] **Step 6: Commit erstellen**

```bash
git add src/features/training/exercises src/features/training/storage/imageCompression.ts src/features/training/ExerciseLibraryPage.tsx src/features/training/ExerciseLibraryPage.test.tsx
git commit -m "feat(training): add searchable exercise library"
```

---

### Task 5: Trainingsplan-Editor mit Standardwerten und Wochentagen

**Dateien:**
- Create: `src/features/training/templates/WorkoutTemplateForm.tsx`
- Create: `src/features/training/templates/WorkoutTemplateEditorPage.tsx`
- Create: `src/features/training/templates/WorkoutTemplateEditorPage.test.tsx`

**Interfaces:**
- Consumes: `WorkoutTemplate`, Übungsbibliothek und Provider-Aktionen.
- Produces: Erstellen/Bearbeiten von Trainingsvorlagen.

- [ ] **Step 1: Fehlschlagende Tests schreiben**

```ts
it('adds a selected exercise with 3 sets and 8-12 repetitions', async () => { /* Bibliothek öffnen, Bankdrücken wählen */ })
it('allows changing target sets and repetition range', async () => { /* 4 × 6-10 */ })
it('assigns the same template to monday and thursday', async () => { /* Checkboxen */ })
it('reorders exercises with buttons and drag-and-drop', async () => { /* beide Wege */ })
it('removes an exercise only after an explicit action', async () => { /* keine versehentliche Karteninteraktion */ })
```

- [ ] **Step 2: Formularmodell implementieren**

Neue Übungen erhalten exakt:

```ts
const DEFAULT_TEMPLATE_EXERCISE = {
  targetSets: 3,
  repMin: 8,
  repMax: 12,
} as const
```

Validierung: Name erforderlich; mindestens eine Übung; eindeutige `exerciseId` pro Plan; Sätze 1–20; Wiederholungen 1–100; `repMin <= repMax`.

- [ ] **Step 3: Sortierung implementieren**

- Dnd-kit `SortableContext` für Pointer und Touch.
- Zusätzlich Schaltflächen `Übung nach oben` und `Übung nach unten`.
- Nach jeder Änderung `order` lückenlos auf 0..n-1 normalisieren.
- Fokus bleibt nach Schaltflächen-Sortierung auf der bewegten Übung.

- [ ] **Step 4: Speichern und Navigation implementieren**

- Neu: stabile ID via `crypto.randomUUID()` und `createdAt`/`updatedAt`.
- Bearbeiten: ID und `createdAt` beibehalten, `updatedAt` ersetzen.
- Nach erfolgreichem Speichern Toast und Navigation zurück nach `/training`.
- Fehler lässt Formular offen und zeigt Toast.

- [ ] **Step 5: Tests und Build ausführen**

```bash
npm run test -- src/features/training/templates/WorkoutTemplateEditorPage.test.tsx
npm run build
```

- [ ] **Step 6: Commit erstellen**

```bash
git add src/features/training/templates
git commit -m "feat(training): add workout template editor"
```

---

### Task 6: Provider, Startseite und genau ein aktives Training

**Dateien:**
- Create: `src/features/training/trainingContext.ts`
- Create: `src/features/training/useTraining.ts`
- Create: `src/features/training/TrainingProvider.tsx`
- Create: `src/features/training/TrainingHomePage.tsx`
- Create: `src/features/training/active/ActiveWorkoutConflictDialog.tsx`
- Create: `src/features/training/model/workoutPrefill.ts`
- Create: `src/features/training/model/workoutPrefill.test.ts`
- Modify: `src/routes/ProtectedShell.tsx`

**Interfaces:**
- Consumes: Repository, Katalog, Templates, Verlauf.
- Produces: zentraler Training-Zustand und Start-/Fortsetzen-Ablauf.

- [ ] **Step 1: Prefill- und Ein-Training-Tests schreiben**

```ts
it('prefills set rows, grip and load mode from the latest completed entry', () => { /* latest endedAt wins */ })
it('keeps the latest note when the next workout is created', () => { /* note copied */ })
it('respects an explicitly cleared latest note and does not revive an older note', () => { /* latest note is empty */ })
it('creates empty rows from template defaults when no history exists', () => { /* 3 rows, incomplete */ })
```

- [ ] **Step 2: `buildActiveWorkout` implementieren**

```ts
export function buildActiveWorkout(input: {
  profileId: string
  template: WorkoutTemplate
  catalog: ExerciseDefinition[]
  completedWorkouts: CompletedWorkout[]
  createId: () => string
  now: () => string
}): ActiveWorkout
```

Regeln:

- Letzten Verlauf nach `endedAt` bestimmen.
- Setwerte inklusive Gewicht, Wiederholungen und Bewertung kopieren, aber `completed: false` setzen.
- Letzte Satzanzahl übernehmen; ohne Verlauf `targetSets` Zeilen erzeugen.
- Letzte Griffvariante und Belastungsart übernehmen.
- Letzte Notiz exakt übernehmen, einschließlich bewusst leerem String.
- Übungssnapshot bei Start einfrieren.

- [ ] **Step 3: TrainingContext mit genau diesen Kernaktionen definieren**

```ts
interface TrainingContextValue {
  status: 'loading' | 'ready' | 'recovery'
  customExercises: ExerciseDefinition[]
  templates: WorkoutTemplate[]
  activeWorkout: ActiveWorkout | null
  completedWorkouts: CompletedWorkout[]
  preferences: TrainingPreferences
  persistenceStatus: 'idle' | 'saving' | 'saved' | 'error'
  createCustomExercise(draft: CustomExerciseDraft): Promise<void>
  saveTemplate(template: WorkoutTemplate): Promise<void>
  deleteTemplate(templateId: string): Promise<void>
  startTemplate(templateId: string): Promise<'started' | 'conflict'>
  discardActiveWorkout(): Promise<void>
  completeActiveWorkout(): Promise<void>
  dispatchActiveWorkout(action: ActiveWorkoutAction): void
  replaceCompletedWorkout(workout: CompletedWorkout): Promise<void>
  deleteCompletedWorkout(workoutId: string): Promise<void>
  updatePreferences(patch: Partial<TrainingPreferences>): Promise<void>
  toggleFavorite(exerciseId: string): Promise<void>
  exportTrainingData(): Promise<void>
  resetTrainingData(): Promise<void>
}
```

- [ ] **Step 4: Provider implementieren**

- Profil-ID aus `useAuth()`.
- Repository als optional injizierbare Prop für Tests.
- Beim Profilwechsel alten Zustand sofort verwerfen und neu laden.
- Schreibvorgänge seriell über eine Promise-Queue ausführen; der neueste aktive Zustand darf nicht durch eine ältere Schreibantwort überschrieben werden.
- Bei Speicherfehler Zustand nicht still als gespeichert markieren.
- `startTemplate` verlässt sich zusätzlich auf die atomare Repository-Prüfung.

- [ ] **Step 5: Startseite implementieren**

Bereiche:

1. Aktives Training mit `Fortsetzen`.
2. `Heute geplant`, berechnet aus lokaler Kalenderwoche und Template-Wochentagen.
3. Alle Trainingsvorlagen mit Starten/Bearbeiten.
4. Aktionen `Trainingsplan erstellen`, `Übungsbibliothek`, `Verlauf`.

Beim Startversuch trotz aktivem Training Dialog mit exakt drei Aktionen: fortsetzen, aktives Training abschließen, aktives Training verwerfen. Abschließen ist nur aktiv, wenn mindestens ein Satz abgeschlossen ist.

- [ ] **Step 6: Provider in ProtectedShell integrieren**

```tsx
export function ProtectedShell() {
  return (
    <TrainingProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </TrainingProvider>
  )
}
```

- [ ] **Step 7: Tests ausführen und committen**

```bash
npm run test -- src/features/training/model/workoutPrefill.test.ts
npm run typecheck
git add src/features/training src/routes/ProtectedShell.tsx
git commit -m "feat(training): add local training provider and home"
```

---

### Task 7: Laufendes Training, Satzbearbeitung und Auto-Save

**Dateien:**
- Create: `src/features/training/model/activeWorkoutReducer.ts`
- Create: `src/features/training/model/activeWorkoutReducer.test.ts`
- Create: `src/features/training/active/WorkoutSetRow.tsx`
- Create: `src/features/training/active/ActiveExerciseCard.tsx`
- Create: `src/features/training/active/ActiveWorkoutPage.tsx`
- Create: `src/features/training/active/ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `ActiveWorkout`, `TrainingContextValue.dispatchActiveWorkout`.
- Produces: `ActiveWorkoutAction`, `activeWorkoutReducer` und vollständige Trainingsansicht.

- [ ] **Step 1: Reducer-Tests für alle Mutationen schreiben**

Aktionen müssen exakt abdecken:

```ts
type ActiveWorkoutAction =
  | { type: 'set-load'; exerciseEntryId: string; setId: string; value: number | null }
  | { type: 'set-repetitions'; exerciseEntryId: string; setId: string; value: number | null }
  | { type: 'set-rating'; exerciseEntryId: string; setId: string; value: number | null }
  | { type: 'toggle-set-completed'; exerciseEntryId: string; setId: string }
  | { type: 'add-set'; exerciseEntryId: string; setId: string }
  | { type: 'remove-set'; exerciseEntryId: string; setId: string }
  | { type: 'set-note'; exerciseEntryId: string; value: string }
  | { type: 'set-grip'; exerciseEntryId: string; value: string | null }
  | { type: 'set-load-mode'; exerciseEntryId: string; value: LoadMode }
  | { type: 'add-exercise'; entry: WorkoutExerciseEntry }
  | { type: 'remove-exercise'; exerciseEntryId: string }
  | { type: 'reorder-exercises'; orderedIds: string[] }
```

Reducer wirft bei unbekannten IDs nicht, sondern gibt unveränderten Zustand zurück. Er normalisiert `order` nach Add/Remove/Reorder. Mindestens ein Satz pro Übung bleibt bestehen.

- [ ] **Step 2: Satzzeile implementieren**

- Inputs mit `inputMode="decimal"` für Belastung und `inputMode="numeric"` für Wiederholungen/Bewertung.
- Leerer Input wird `null`, niemals automatisch 0.
- Bewertung nur anzeigen, wenn `showSetRating` aktiv ist.
- Bewertung 1–10; ungültige Werte nicht als abgeschlossenen Satz akzeptieren.
- Checkbox/Schaltfläche `Satz abschließen`.
- `Letztes Training` bleibt als separater Vergleichstext sichtbar, auch wenn Felder vorausgefüllt sind.

- [ ] **Step 3: Belastungsmodi für Klimmzüge und Dips implementieren**

Auswahl auf Übungsebene:

- Eigengewicht: `loadMode = 'bodyweight'`, Belastungsfeld optional/ausgeblendet.
- Zusatzgewicht: `loadMode = 'added-weight'`, Anzeige `+ kg`.
- Unterstützung: `loadMode = 'assisted-weight'`, Anzeige `− kg Unterstützung`.

Zuletzt verwendeter Modus und Wert bleiben vorausgefüllt. Kein Körpergewicht und keine Gesamtlast berechnen.

- [ ] **Step 4: Aktive Übungskarte implementieren**

- technische Illustration und Name,
- Ziel `3 × 8–12` beziehungsweise aktuelle Zielwerte,
- Griffauswahl, falls Varianten vorhanden,
- Notizfeld mit persistiertem Wert,
- Satzliste,
- Satz hinzufügen/löschen,
- Übung entfernen mit Bestätigung,
- nach oben/unten sowie Drag-and-drop sortieren.

- [ ] **Step 5: Aktive Trainingsseite implementieren**

- Startzeit und laufende Dauer nur als Anzeige; kein Timer-Intervall für Pausen.
- Auto-Save-Status `Speichert…`, `Gespeichert`, `Speicherfehler`.
- Übungen spontan aus Bibliothek hinzufügen.
- `Training abschließen` und `Training verwerfen` mit `ResponsiveDialog`.
- Nach Reload wird derselbe aktive Zustand aus IndexedDB gerendert.

- [ ] **Step 6: Komponenten-Tests ausführen**

```bash
npm run test -- src/features/training/model/activeWorkoutReducer.test.ts src/features/training/active/ActiveWorkoutPage.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit erstellen**

```bash
git add src/features/training/model/activeWorkoutReducer* src/features/training/active
git commit -m "feat(training): add active workout tracking"
```

---

### Task 8: Abschluss, Verlauf, nachträgliches Bearbeiten und Löschen

**Dateien:**
- Create: `src/features/training/history/WorkoutHistoryPage.tsx`
- Create: `src/features/training/history/WorkoutHistoryDetailPage.tsx`
- Create: `src/features/training/history/WorkoutHistoryPage.test.tsx`
- Modify: `src/features/training/TrainingProvider.tsx`

**Interfaces:**
- Consumes: aktive und abgeschlossene Workouts, Repository-Transaktionen.
- Produces: Verlaufsliste, Detailansicht, Editier- und Löschablauf.

- [ ] **Step 1: Fehlschlagende Verlaufstests schreiben**

```ts
it('completes an active workout and removes the active session', async () => { /* atomare Provider-Aktion */ })
it('shows completed workouts newest first', async () => { /* endedAt */ })
it('edits a wrong weight and persists the replacement', async () => { /* 80 -> 82.5 */ })
it('requires confirmation before deleting a completed workout', async () => { /* ResponsiveDialog */ })
it('keeps incomplete sets in history but marks them as not counted', async () => { /* keine Ableitung */ })
```

- [ ] **Step 2: Abschlussabbildung implementieren**

```ts
export function toCompletedWorkout(active: ActiveWorkout, endedAt: string): CompletedWorkout {
  return {
    schemaVersion: 1,
    id: active.id,
    ownerProfileId: active.profileId,
    templateId: active.templateId,
    name: active.name,
    startedAt: active.startedAt,
    endedAt,
    updatedAt: endedAt,
    exercises: structuredClone(active.exercises),
  }
}
```

Mindestens ein abgeschlossener Satz erforderlich. Unvollständige Sätze werden gespeichert, aber visuell als `Nicht abgeschlossen` markiert.

- [ ] **Step 3: Verlaufsliste und Details implementieren**

- Datum, Trainingsname, Dauer und Anzahl abgeschlossener Sätze.
- Detailansicht pro Übung und Satz.
- Bearbeiten schaltet explizit in einen Editiermodus; Speichern ersetzt den Eintrag und aktualisiert `updatedAt`.
- Übungsname kommt aus `exerciseSnapshot`, sodass spätere Änderungen eigener Übungen die Historie nicht zerstören.

- [ ] **Step 4: Löschen implementieren**

`ResponsiveDialog` mit Trainingstitel und Datum. Nach Bestätigung Repository-Löschung, Toast, Navigation zur Verlaufsliste. Kein Undo in Phase 1.

- [ ] **Step 5: Tests und Commit**

```bash
npm run test -- src/features/training/history/WorkoutHistoryPage.test.tsx
npm run build
git add src/features/training/history src/features/training/TrainingProvider.tsx
git commit -m "feat(training): add editable workout history"
```

---

### Task 9: Steigerungslogik und Trainingseinstellungen

**Dateien:**
- Create: `src/features/training/model/progression.ts`
- Create: `src/features/training/model/progression.test.ts`
- Create: `src/features/training/settings/TrainingSettings.tsx`
- Create: `src/features/training/settings/TrainingSettings.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/training/active/ActiveExerciseCard.tsx`

**Interfaces:**
- Consumes: Verlauf und `TrainingPreferences`.
- Produces: `getProgressionSuggestion()` und Einstellungs-UI.

- [ ] **Step 1: Algorithmus-Tests schreiben**

```ts
it('suggests +2.5 kg after three matching successful workouts', () => { /* 3 x 12, average <= 8 */ })
it('does not count incomplete sets', () => { /* incomplete rows ignored, required completed count not met */ })
it('does not suggest when weights differ across the required workouts', () => { /* same-weight rule */ })
it('honors a custom two-workout threshold and rating limit', () => { /* configurable */ })
it('reduces assistance by 2.5 kg for assisted pull-ups', () => { /* 30 -> 27.5 */ })
it('suggests switching bodyweight to +2.5 kg after successful bodyweight sessions', () => { /* no total load */ })
it('ignores rating when rating is disabled or no ratings were recorded', () => { /* repetitions still count */ })
```

- [ ] **Step 2: Reine Steigerungsfunktion implementieren**

```ts
export interface ProgressionSuggestion {
  exerciseId: string
  loadMode: LoadMode
  previousLoad: number | null
  suggestedLoad: number | null
  message: string
}

export function getProgressionSuggestion(input: {
  exerciseId: string
  gripVariant: string | null
  completedWorkouts: CompletedWorkout[]
  preferences: TrainingPreferences
}): ProgressionSuggestion | null
```

Erfolg pro Training:

- mindestens `targetSets` abgeschlossene Sätze,
- alle gezählten Sätze erreichen `repMax`,
- alle gezählten Sätze nutzen denselben Belastungswert und Modus,
- falls Bewertungen vorhanden und aktiviert: Durchschnitt <= Grenzwert,
- die letzten N Vorkommen derselben Übung und Griffvariante müssen erfolgreich sein,
- alle N Trainings müssen denselben Belastungswert und Modus verwenden.

Vorschlag:

- `weight`/`added-weight`: vorherige Last + Erhöhung,
- `assisted-weight`: Unterstützung minus Erhöhung, nicht unter 0,
- `bodyweight`: Wechsel zu `added-weight` mit Erhöhung.

- [ ] **Step 3: Einstellungen implementieren**

Neue Karte in `SettingsPage`:

- Satzbewertung anzeigen an/aus,
- Steigerungsempfehlungen an/aus,
- erfolgreiche Trainings 2–5,
- Bewertungsgrenze 1–10,
- Standarderhöhung in 0,5-kg-Schritten, Default 2,5.

Jede Änderung wird lokal gespeichert. Bei deaktivierter Satzbewertung bleiben historische Bewertungen erhalten, werden aber nicht angezeigt oder für neue Eingaben verlangt.

- [ ] **Step 4: Hinweis in aktiver Übung anzeigen**

Nur bei vorhandener Suggestion, dezent und wegklickbar für die aktuelle Sitzung. Das Wegklicken ändert nicht global die Einstellung. Beispiel:

`Du hast 80 kg × 12 in 3 Trainings geschafft. Du könntest heute 82,5 kg ausprobieren.`

- [ ] **Step 5: Tests und Commit**

```bash
npm run test -- src/features/training/model/progression.test.ts src/features/training/settings/TrainingSettings.test.tsx
npm run typecheck
git add src/features/training/model/progression* src/features/training/settings src/features/settings/SettingsPage.tsx src/features/training/active/ActiveExerciseCard.tsx
git commit -m "feat(training): add progression settings and suggestions"
```

---

### Task 10: Routing, Recovery, Styling und vollständige Offline-Verfügbarkeit

**Dateien:**
- Modify: `src/routes/router.tsx`
- Create: `src/features/training/TrainingRecoveryPanel.tsx`
- Create: `src/features/training/training.css`
- Modify: `src/pwa/pwaConfig.ts`
- Modify: `src/features/training/TrainingProvider.tsx`

**Interfaces:**
- Consumes: alle Seiten und Recovery-Aktionen.
- Produces: erreichbare Training-Routen, fehlertolerante Ansicht und offline gecachte Assets.

- [ ] **Step 1: Routing-Test schreiben**

Erwartete Routen:

```tsx
{ path: 'training', element: <TrainingHomePage /> }
{ path: 'training/exercises', element: <ExerciseLibraryPage /> }
{ path: 'training/templates/new', element: <WorkoutTemplateEditorPage /> }
{ path: 'training/templates/:templateId', element: <WorkoutTemplateEditorPage /> }
{ path: 'training/active', element: <ActiveWorkoutPage /> }
{ path: 'training/history', element: <WorkoutHistoryPage /> }
{ path: 'training/history/:workoutId', element: <WorkoutHistoryDetailPage /> }
```

Tests prüfen, dass `/training` nicht mehr `PlaceholderPage` rendert und andere Routen unverändert bleiben.

- [ ] **Step 2: Recovery-Ansicht implementieren**

Bei beschädigten/nicht migrierbaren Daten:

- verständlicher Text `Trainingsdaten konnten nicht vollständig gelesen werden.`,
- Button `Rohdaten exportieren`,
- Button `Trainingsbereich zurücksetzen`,
- Reset nur nach `ResponsiveDialog`-Bestätigung,
- keine automatische Überschreibung,
- nach Reset Reload des TrainingProvider-Zustands.

- [ ] **Step 3: Mobile-first CSS implementieren**

Mindestanforderungen:

- Touch-Ziele mindestens 44 × 44 px,
- Satzfelder auf kleinen Displays ohne horizontales Seiten-Scrollen,
- Karten ab 768 px zweispaltig, ab 1100 px dreispaltig,
- aktive Übung auf Mobile einspaltig,
- klare Fokusindikatoren aus Design-Tokens,
- Haupt-/Nebenmuskel-Legende sichtbar,
- Light/Dark Mode ohne hart codierte unlesbare Farben,
- `prefers-reduced-motion` für Drag-/Dialog-Animationen respektieren.

- [ ] **Step 4: PWA-Precache prüfen**

`globPatterns` muss mindestens enthalten:

```ts
globPatterns: ['**/*.{js,css,html,svg,woff2}']
```

Keine Runtime-Anfrage für Standardübungen oder SVGs. Nach Produktions-Build in generierter Service-Worker-Manifestdatei mindestens stichprobenartig `exercises/bench-press.svg`, `exercises/lat-pulldown.svg`, `exercises/leg-press.svg` und `exercises/fallback.svg` nachweisen.

- [ ] **Step 5: Routing-, Build- und Security-Prüfung**

```bash
npm run test
npm run build
npm run security:scan
```

- [ ] **Step 6: Commit erstellen**

```bash
git add src/routes/router.tsx src/features/training/TrainingRecoveryPanel.tsx src/features/training/training.css src/features/training/TrainingProvider.tsx src/pwa/pwaConfig.ts
git commit -m "feat(training): integrate offline training experience"
```

---

### Task 11: Mobile E2E, Offline-Fortsetzung, Dokumentation und Abschlussprüfung

**Dateien:**
- Create: `tests/e2e/training.spec.ts`
- Create or Modify: `tests/e2e/previewSession.ts` nur falls Trainingsfixtures eine kleine Erweiterung benötigen
- Modify: `README.md`

**Interfaces:**
- Consumes: vollständige Phase-1-Funktion.
- Produces: reproduzierbare End-to-End-Abdeckung und Nutzungsdokumentation.

- [ ] **Step 1: Mobilen Hauptablauf als E2E-Test schreiben**

Auf `iphone-webkit`:

1. Preview-Session installieren.
2. `/training` öffnen.
3. Plan `Oberkörper` erstellen.
4. Bankdrücken und Latziehen hinzufügen; Defaults `3 × 8–12` prüfen.
5. Montag und Donnerstag auswählen.
6. Training starten.
7. 80 kg, 10 Wiederholungen, Bewertung 7 eintragen und Satz abschließen.
8. Notiz `Bank Stufe 4` und Latziehgriff `Neutral` speichern.
9. Seite neu laden und exakt denselben aktiven Stand prüfen.
10. Training abschließen und Verlauf prüfen.
11. Zweites Training starten und vorausgefüllte Werte, Notiz und Griff prüfen.

- [ ] **Step 2: Ein-Training-Konflikt als E2E-Test schreiben**

Aktives Training erzeugen, zweiten Plan starten und Dialogaktionen `Fortsetzen`, `Abschließen`, `Verwerfen` prüfen. Kein zweiter aktiver IndexedDB-Datensatz darf entstehen.

- [ ] **Step 3: Offline-Test schreiben**

Auf Chromium mit Produktions-Preview und installiertem Service Worker:

```ts
await page.goto('/training/exercises')
await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
await context.setOffline(true)
await page.reload()
await expect(page.getByRole('heading', { name: 'Übungsbibliothek' })).toBeVisible()
await expect(page.getByRole('img', { name: /Bankdrücken/ })).toBeVisible()
```

Danach offline aktives Training ändern, reloaden und Persistenz prüfen. WebKit-Test darf den Service-Worker-spezifischen Teil überspringen, der mobile Funktionsablauf muss dort trotzdem laufen.

- [ ] **Step 4: Barrierefreiheits-/Regressionstest ergänzen**

- alle sichtbaren Inputs haben Labels,
- Sortierbuttons sind per Tastatur erreichbar,
- kein horizontaler Overflow bei iPhone 13,
- Dialogfokus bleibt im obersten Dialog,
- bestehende mobile Navigation zeigt weiterhin Training,
- Kalender- und Settings-Seite bleiben erreichbar.

- [ ] **Step 5: README aktualisieren**

Dokumentieren:

- Trainingsdaten sind lokal und profilbezogen,
- vollständig offline nach erstem erfolgreichen Laden/Installation,
- keine Synchronisierung zwischen Geräten,
- Browserdaten löschen entfernt Trainingsdaten,
- Export/Reset im Recovery-Fall,
- keine Push-Erinnerungen in Phase 1.

- [ ] **Step 6: Vollständige Verifikation ausführen**

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run test:e2e
npm run check
```

Erwartung:

- 0 ESLint-Warnungen/Fehler,
- TypeScript erfolgreich,
- alle Unit-/Komponenten-Tests erfolgreich,
- Produktions-Build erfolgreich,
- Security-Scan erfolgreich,
- Desktop Chromium und iPhone WebKit ohne unerwartete Fehler,
- bestehende erwartete Supabase-Skips bleiben erwartete Skips.

- [ ] **Step 7: Feature-Abschluss committen**

```bash
git add tests/e2e/training.spec.ts README.md
git commit -m "test(training): cover offline mobile workout flow"
```

- [ ] **Step 8: Diff und Scope vor PR prüfen**

```bash
git status --short
git diff --check
git log --oneline --decorate main..HEAD
git diff --stat main...HEAD
```

Bestätigen:

- keine Supabase-Dateien geändert,
- keine Push-/Reminder-Implementierung,
- keine Phase-2-Funktionen,
- keine ungetrackten Bilder oder Trainingsdateien vergessen,
- genau 50 Standardübungen und 50 zugehörige SVGs plus Fallback vorhanden.

- [ ] **Step 9: Pull Request vorbereiten**

Titel:

```text
feat: add offline training tracker
```

PR-Beschreibung enthält Umfang, Offline-Datenhaltung, Testresultate, bewusste Phase-2-Abgrenzung und Screenshots von Training-Startseite, Bibliothek, aktivem Training und Verlauf. Noch nicht mergen, bis CI grün und Review abgeschlossen ist.

---

## Selbstprüfung des Plans

- **Spec-Abdeckung:** Übungsbibliothek, 50 Illustrationen, eigene Übungen, Favoriten, Vorlagen, mehrere Wochentage, ein aktives Training, Auto-Save, Prefill, Notizsemantik, Griffvarianten, Klimmzug-/Dip-Modi, Verlauf, Bearbeiten/Löschen, Satzbewertung, Steigerungsregel, Recovery und Offline-E2E sind jeweils einem Task zugeordnet.
- **Nicht-Ziele:** Supabase-Sync, Push, Uhrzeiten, Timer, Aufwärmsätze, Körpergewicht und Analysefunktionen sind ausdrücklich ausgeschlossen.
- **Typkonsistenz:** `profileId` ist der Key des aktiven Trainings; persistente Profilobjekte verwenden `ownerProfileId`, Preferences verwenden `profileId`. `WorkoutExerciseEntry` und `WorkoutSetEntry` werden unverändert von aktivem Training in den Verlauf kopiert.
- **Fehlende Platzhalter:** Die 50 Übungen, Routen, Aktionen, Standardwerte, Algorithmusregeln, Stores, Tests und Commit-Grenzen sind konkret benannt.
