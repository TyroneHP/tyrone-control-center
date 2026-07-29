# Training Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/training` placeholder with a mobile-first, fully offline training area containing 50 standard exercises, custom exercises, workout templates, exactly one active workout, editable history, and configurable progressive-overload recommendations.

**Architecture:** Ship the standard exercise catalog and technical SVG illustrations as static PWA assets. Store mutable profile-scoped training data in IndexedDB behind a small `TrainingRepository`; validate every read with Zod and expose all mutations through a `TrainingProvider`. Keep calculations pure and independently tested, and reuse the existing router, design system, `ResponsiveDialog`, toast system, and mobile navigation.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Zod 4, IndexedDB via `idb`, `@dnd-kit`, Vite PWA/Workbox, Vitest, Testing Library, `fake-indexeddb`, Playwright.

## Global Constraints

- Training data stays exclusively local to the current device in Phase 1.
- Do not add Supabase tables, migrations, Edge Functions, API calls, synchronization, secrets, or remote storage.
- Do not add push notifications, reminder times, background jobs, pause timers, warm-up-set markers, body weight, total bodyweight load, charts, volume analysis, muscle-group analysis, or AI training planning.
- Weekdays only drive the `Heute geplant` display.
- A profile may have at most one active workout.
- New template exercises default to `3 × 8–12`.
- Set ratings are integers from 1 through 10 and can be hidden globally.
- Progression defaults are 3 successful workouts, maximum average rating 8, increment 2.5 kg.
- Sorting must work both with drag-and-drop and explicit move-up/move-down buttons.
- Primary and secondary muscles must always be named in text; color intensity alone must not carry meaning.
- Existing authentication, calendar, navigation, settings, PWA behavior, and Supabase security must remain intact.
- Do not commit directly to `main`. Use a dedicated feature branch and finish through a pull request.

---

## Planned File Structure

```text
src/features/training/
├── TrainingProvider.tsx
├── trainingContext.ts
├── useTraining.ts
├── training.css
├── model/
│   ├── trainingTypes.ts
│   ├── trainingSchemas.ts
│   ├── trainingDefaults.ts
│   ├── workoutModel.ts
│   ├── progression.ts
│   └── exerciseCatalog.ts
├── persistence/
│   ├── trainingRepository.ts
│   ├── indexedDbTrainingRepository.ts
│   └── trainingMigrations.ts
├── components/
│   ├── ExerciseCard.tsx
│   ├── ExerciseIllustration.tsx
│   ├── ExercisePickerDialog.tsx
│   ├── ExerciseEditorDialog.tsx
│   ├── SortableExerciseList.tsx
│   ├── WorkoutSetRow.tsx
│   └── TrainingRecoveryDialog.tsx
└── pages/
    ├── TrainingHomePage.tsx
    ├── ExerciseLibraryPage.tsx
    ├── WorkoutTemplateEditorPage.tsx
    ├── ActiveWorkoutPage.tsx
    ├── WorkoutHistoryPage.tsx
    └── CompletedWorkoutPage.tsx
public/training/exercises/*.svg
tests/e2e/training.spec.ts
```

## Task 1: Dependencies, Domain Types, and Validation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/training/model/trainingTypes.ts`
- Create: `src/features/training/model/trainingDefaults.ts`
- Create: `src/features/training/model/trainingSchemas.ts`
- Test: `src/features/training/model/trainingSchemas.test.ts`

**Interfaces:**
- Produces `TrainingState`, `ExerciseDefinition`, `WorkoutTemplate`, `ActiveWorkout`, `CompletedWorkout`, `TrainingPreferences`, `trainingStateSchema`, and `DEFAULT_TRAINING_PREFERENCES`.

- [ ] **Step 1: Install the local-only dependencies**

```bash
npm install idb @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install --save-dev fake-indexeddb
```

- [ ] **Step 2: Define the domain types**

Use these exact public shapes in `trainingTypes.ts`:

```ts
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ExerciseSource = 'standard' | 'custom'
export type LoadMode = 'external' | 'bodyweight' | 'added' | 'assisted'
export type ExerciseUnit = 'kg-reps' | 'reps' | 'seconds'

export interface ExerciseDefinition {
  id: string
  source: ExerciseSource
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string[]
  unit: ExerciseUnit
  description: string
  gripOptions: string[]
  supportsBodyweightModes: boolean
  illustrationPath?: string
  customImageId?: string
}

export interface WorkoutTemplateExercise {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  preferredGrip?: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  weekdays: Weekday[]
  exercises: WorkoutTemplateExercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutSetEntry {
  id: string
  weightKg: number | null
  reps: number | null
  rating: number | null
  completed: boolean
}

export interface WorkoutExerciseEntry {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  grip?: string
  loadMode: LoadMode
  note: string
  sets: WorkoutSetEntry[]
}

export interface ActiveWorkout {
  id: string
  templateId?: string
  name: string
  startedAt: string
  updatedAt: string
  exercises: WorkoutExerciseEntry[]
}

export interface CompletedWorkout extends Omit<ActiveWorkout, 'updatedAt'> {
  completedAt: string
}

export interface TrainingPreferences {
  showSetRating: boolean
  progressionEnabled: boolean
  successfulWorkoutCount: number
  maximumAverageRating: number
  defaultIncrementKg: number
}

export interface TrainingState {
  schemaVersion: 1
  customExercises: ExerciseDefinition[]
  favoriteExerciseIds: string[]
  templates: WorkoutTemplate[]
  activeWorkout: ActiveWorkout | null
  completedWorkouts: CompletedWorkout[]
  preferences: TrainingPreferences
}
```

- [ ] **Step 3: Define defaults**

```ts
export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  showSetRating: true,
  progressionEnabled: true,
  successfulWorkoutCount: 3,
  maximumAverageRating: 8,
  defaultIncrementKg: 2.5,
}

export const EMPTY_TRAINING_STATE: TrainingState = {
  schemaVersion: 1,
  customExercises: [],
  favoriteExerciseIds: [],
  templates: [],
  activeWorkout: null,
  completedWorkouts: [],
  preferences: DEFAULT_TRAINING_PREFERENCES,
}
```

- [ ] **Step 4: Write failing schema tests**

Cover rating boundaries, rep ranges, unique IDs, weekday values, load modes, non-negative weights, and the exact default state.

```ts
it('rejects ratings outside 1 through 10', () => {
  const result = workoutSetEntrySchema.safeParse({
    id: 'set-1', weightKg: 50, reps: 10, rating: 11, completed: true,
  })
  expect(result.success).toBe(false)
})
```

- [ ] **Step 5: Implement strict Zod schemas and run tests**

```bash
npm test -- src/features/training/model/trainingSchemas.test.ts
```

Expected: all schema tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/training/model
git commit -m "feat(training): add local training domain model"
```

## Task 2: IndexedDB Repository, Migration, Export, and Reset

**Files:**
- Create: `src/features/training/persistence/trainingRepository.ts`
- Create: `src/features/training/persistence/trainingMigrations.ts`
- Create: `src/features/training/persistence/indexedDbTrainingRepository.ts`
- Test: `src/features/training/persistence/indexedDbTrainingRepository.test.ts`

**Interfaces:**
- Produces `TrainingRepository` with `load`, `save`, `saveImage`, `loadImage`, `deleteImage`, `exportRaw`, and `reset`.

```ts
export interface TrainingRepository {
  load(profileId: string): Promise<TrainingState>
  save(profileId: string, state: TrainingState): Promise<void>
  saveImage(profileId: string, imageId: string, blob: Blob): Promise<void>
  loadImage(profileId: string, imageId: string): Promise<Blob | undefined>
  deleteImage(profileId: string, imageId: string): Promise<void>
  exportRaw(profileId: string): Promise<string>
  reset(profileId: string): Promise<void>
}
```

- [ ] **Step 1: Write failing repository tests with `fake-indexeddb/auto`**

Test profile isolation, round-trip persistence, single atomic state record, image blobs, corrupted state rejection, export, reset, and a v0-to-v1 migration fixture.

- [ ] **Step 2: Create the IndexedDB schema**

Use database `coregrid-training`, version `1`, with stores:

```ts
interface TrainingDb extends DBSchema {
  states: { key: string; value: TrainingState }
  images: { key: string; value: { profileId: string; blob: Blob } }
}
```

Image keys must be `${profileId}:${imageId}`. Never mix profile data.

- [ ] **Step 3: Validate every loaded value**

`load()` must parse through `trainingStateSchema`. A missing record returns `EMPTY_TRAINING_STATE`; an invalid record throws `TrainingDataCorruptionError` without overwriting it.

- [ ] **Step 4: Implement migration entry point**

```ts
export function migrateTrainingState(value: unknown): TrainingState {
  const record = value as { schemaVersion?: unknown }
  if (record?.schemaVersion === 1) return trainingStateSchema.parse(record)
  if (record?.schemaVersion === 0) return migrateV0ToV1(record)
  throw new TrainingDataCorruptionError('Unbekannte Trainingsdaten-Version.')
}
```

- [ ] **Step 5: Run repository tests**

```bash
npm test -- src/features/training/persistence/indexedDbTrainingRepository.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/features/training/persistence
git commit -m "feat(training): persist profile data in IndexedDB"
```

## Task 3: Standard Exercise Catalog and Technical Illustrations

**Files:**
- Create: `src/features/training/model/exerciseCatalog.ts`
- Create: `src/features/training/model/exerciseCatalog.test.ts`
- Create: `src/features/training/components/ExerciseIllustration.tsx`
- Create: `public/training/exercises/*.svg`

**Interfaces:**
- Produces `STANDARD_EXERCISES`, `exerciseById`, and `getExerciseDefinition`.

- [ ] **Step 1: Write catalog integrity tests**

Tests must assert exactly 50 unique standard IDs, non-empty primary muscles, valid illustration paths, unique names, and explicit presence of all user-required exercises.

- [ ] **Step 2: Add exactly these 50 exercise IDs**

```text
bench-press
incline-bench-press
dumbbell-bench-press
incline-dumbbell-press
machine-chest-press
pec-deck
cable-fly
lat-pulldown
close-grip-lat-pulldown
pull-up
t-bar-row
seated-cable-row
chest-supported-row
barbell-row
one-arm-dumbbell-row
straight-arm-pulldown
face-pull
back-squat
leg-press
romanian-deadlift
conventional-deadlift
hack-squat
bulgarian-split-squat
walking-lunge
leg-extension
seated-leg-curl
lying-leg-curl
hip-thrust
standing-calf-raise
seated-calf-raise
machine-shoulder-press
dumbbell-shoulder-press
dumbbell-lateral-raise
cable-lateral-raise
reverse-pec-deck
rear-delt-cable-fly
front-raise
barbell-curl
dumbbell-curl
hammer-curl
preacher-curl
cable-curl
rope-pushdown
katana-triceps-extension
overhead-cable-triceps-extension
dip
machine-crunch
cable-crunch
hanging-leg-raise
plank
```

- [ ] **Step 3: Add grip options**

`lat-pulldown` and `close-grip-lat-pulldown`: `Breit`, `Eng`, `Neutral`, `Untergriff`.

`seated-cable-row`: `Enger Parallelgriff`, `Breit`, `Neutral`, `Einarmig`.

Set `supportsBodyweightModes: true` only for `pull-up` and `dip`.

- [ ] **Step 4: Create the SVG asset set**

Create one SVG per ID under `public/training/exercises/`. Every file must use `viewBox="0 0 640 360"`, a transparent background, dark neutral outlines, a visible start pose, a lighter end pose, an orange motion arrow, and a compact front/back muscle map. Primary muscles use `#f59e0b`; secondary muscles use the same color at opacity `0.38`. No brand logos, text baked into the drawing, raster images, or remote URLs.

- [ ] **Step 5: Implement accessible rendering**

```tsx
export function ExerciseIllustration({ exercise, decorative = false }: Props) {
  return (
    <img
      alt={decorative ? '' : `Technische Darstellung: ${exercise.name}`}
      aria-hidden={decorative || undefined}
      loading="lazy"
      src={`${import.meta.env.BASE_URL}${exercise.illustrationPath}`}
    />
  )
}
```

- [ ] **Step 6: Run catalog tests and production build**

```bash
npm test -- src/features/training/model/exerciseCatalog.test.ts
npm run build
```

Confirm all 50 SVGs are present in `dist/training/exercises/`.

- [ ] **Step 7: Commit**

```bash
git add src/features/training/model/exerciseCatalog* src/features/training/components/ExerciseIllustration.tsx public/training/exercises
git commit -m "feat(training): add standard exercise library"
```

## Task 4: Pure Workout and Progression Logic

**Files:**
- Create: `src/features/training/model/workoutModel.ts`
- Create: `src/features/training/model/workoutModel.test.ts`
- Create: `src/features/training/model/progression.ts`
- Create: `src/features/training/model/progression.test.ts`

**Interfaces:**
- Produces `createWorkoutTemplate`, `startWorkout`, `updateWorkoutSet`, `completeWorkout`, `replaceCompletedWorkout`, `deleteCompletedWorkout`, `findLastExerciseEntry`, and `getProgressionRecommendation`.

- [ ] **Step 1: Write failing tests for templates and active workouts**

Cover `3 × 8–12`, custom targets, exactly one active workout, add/remove/reorder exercise, add/remove sets, grip restoration, bodyweight mode restoration, and prefill from the latest completed occurrence.

- [ ] **Step 2: Implement template creation**

```ts
export function createTemplateExercise(exerciseId: string, order: number): WorkoutTemplateExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    order,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
  }
}
```

- [ ] **Step 3: Implement last-session prefill**

When a prior entry exists, clone its set count, `weightKg`, `reps`, `rating`, `grip`, `loadMode`, and note into the new active entry. Create new set IDs. If no prior entry exists, create the planned number of empty sets. Because the note is prefilled, leaving it untouched preserves it; explicitly clearing it stores an empty string.

- [ ] **Step 4: Implement completion rules**

Only sets with `completed === true`, a non-null rep value, and the required load value count toward recommendations. Incomplete sets remain persisted but excluded from calculations.

- [ ] **Step 5: Write and implement progression tests**

Exact rule:

```ts
export interface ProgressionRecommendation {
  exerciseId: string
  currentWeightKg: number
  suggestedWeightKg: number
  successfulWorkoutCount: number
}
```

Use the latest consecutive `preferences.successfulWorkoutCount` occurrences of the exercise. Every completed set in every occurrence must reach `repMax`. If ratings are enabled, every counted set must have a rating and the average across all counted sets must be `<= maximumAverageRating`; if ratings are disabled, skip the rating criterion. All counted sets must use the same load mode and weight. Suggested weight is `currentWeightKg + defaultIncrementKg`; for assisted mode it is `Math.max(0, currentWeightKg - defaultIncrementKg)` because less assistance is harder.

- [ ] **Step 6: Run model tests**

```bash
npm test -- src/features/training/model/workoutModel.test.ts src/features/training/model/progression.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/features/training/model/workoutModel* src/features/training/model/progression*
git commit -m "feat(training): add workout and progression logic"
```

## Task 5: Training Provider and Route Integration

**Files:**
- Create: `src/features/training/trainingContext.ts`
- Create: `src/features/training/useTraining.ts`
- Create: `src/features/training/TrainingProvider.tsx`
- Test: `src/features/training/TrainingProvider.test.tsx`
- Modify: `src/routes/ProtectedShell.tsx`
- Modify: `src/routes/router.tsx`

**Interfaces:**
- `TrainingProvider` receives `profileId`, optional `repository`, and `children`.
- Context exposes loaded state, catalog, mutation methods, `loading`, and `recoveryError`.

- [ ] **Step 1: Write provider tests**

Test profile-scoped load, autosave after every mutation, profile switch reset, one active workout, persistence failure toast/error state, and recovery from reload.

- [ ] **Step 2: Implement a serialized save queue**

Do not allow older async writes to overwrite newer state. Chain repository writes through one promise and keep the latest immutable snapshot.

- [ ] **Step 3: Wrap protected routes**

```tsx
export function ProtectedShell() {
  const { profile } = useAuth()
  if (!profile) return null
  return (
    <TrainingProvider key={profile.id} profileId={profile.id}>
      <AppShell><Outlet /></AppShell>
    </TrainingProvider>
  )
}
```

- [ ] **Step 4: Replace the training placeholder with nested routes**

```tsx
{
  path: 'training',
  children: [
    { index: true, element: <TrainingHomePage /> },
    { path: 'library', element: <ExerciseLibraryPage /> },
    { path: 'templates/new', element: <WorkoutTemplateEditorPage /> },
    { path: 'templates/:templateId/edit', element: <WorkoutTemplateEditorPage /> },
    { path: 'active', element: <ActiveWorkoutPage /> },
    { path: 'history', element: <WorkoutHistoryPage /> },
    { path: 'history/:workoutId', element: <CompletedWorkoutPage /> },
  ],
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/features/training/TrainingProvider.test.tsx src/routes/router.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/training/TrainingProvider* src/features/training/trainingContext.ts src/features/training/useTraining.ts src/routes
git commit -m "feat(training): connect local training state to routes"
```

## Task 6: Exercise Library and Custom Exercises

**Files:**
- Create: `src/features/training/components/ExerciseCard.tsx`
- Create: `src/features/training/components/ExercisePickerDialog.tsx`
- Create: `src/features/training/components/ExerciseEditorDialog.tsx`
- Create: `src/features/training/pages/ExerciseLibraryPage.tsx`
- Test: `src/features/training/pages/ExerciseLibraryPage.test.tsx`
- Create: `src/features/training/imageProcessing.ts`
- Test: `src/features/training/imageProcessing.test.ts`

- [ ] **Step 1: Write failing library tests**

Cover name search, primary-muscle filter, equipment filter, favorites, detail view, custom exercise creation, optional image, fallback illustration, edit, and delete confirmation.

- [ ] **Step 2: Implement image normalization**

Decode an uploaded image into a canvas, preserve aspect ratio, cap the longest edge at 1280 px, export WebP at quality `0.82`, and reject output larger than 1.5 MB with a German validation message. Store only the processed Blob in IndexedDB.

- [ ] **Step 3: Implement custom exercise validation**

Name and at least one primary muscle are required. Equipment, secondary muscles, description, unit, and image are optional. Custom IDs use `custom:${crypto.randomUUID()}`.

- [ ] **Step 4: Build the card and detail UI**

Cards display illustration, name, primary muscle text, equipment, and favorite action. The detail dialog displays larger illustration, `Hauptmuskeln`, `Nebenmuskeln`, description, grip options, and `Zum Training hinzufügen` when used as a picker.

- [ ] **Step 5: Run component tests**

```bash
npm test -- src/features/training/pages/ExerciseLibraryPage.test.tsx src/features/training/imageProcessing.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/features/training/components/Exercise* src/features/training/pages/ExerciseLibraryPage* src/features/training/imageProcessing*
git commit -m "feat(training): add exercise library and custom exercises"
```

## Task 7: Workout Templates and Training Home

**Files:**
- Create: `src/features/training/components/SortableExerciseList.tsx`
- Create: `src/features/training/pages/WorkoutTemplateEditorPage.tsx`
- Create: `src/features/training/pages/TrainingHomePage.tsx`
- Test: `src/features/training/pages/WorkoutTemplateEditorPage.test.tsx`
- Test: `src/features/training/pages/TrainingHomePage.test.tsx`

- [ ] **Step 1: Write failing template tests**

Cover name, multiple weekdays, exercise picker, defaults, editable set/rep targets, removal, drag sorting, button sorting, save, edit, and delete confirmation.

- [ ] **Step 2: Implement accessible sorting**

Use `@dnd-kit/sortable` for pointer/keyboard drag and always render buttons labelled `Übung nach oben` and `Übung nach unten`. Normalize `order` to contiguous zero-based values after every move.

- [ ] **Step 3: Implement weekday selection**

Store ISO weekdays `1` Monday through `7` Sunday. Display German short labels. Do not store time-of-day or schedule notifications.

- [ ] **Step 4: Build the home page**

Priority order:
1. `Training fortsetzen` when active.
2. `Heute geplant` templates matching the current weekday.
3. All templates.
4. Links to library and history.

Starting a plan while another workout is active opens a `ResponsiveDialog` with exactly: `Fortsetzen`, `Aktives Training abschließen`, `Aktives Training verwerfen`. Destructive actions require a second confirmation.

- [ ] **Step 5: Run tests**

```bash
npm test -- src/features/training/pages/WorkoutTemplateEditorPage.test.tsx src/features/training/pages/TrainingHomePage.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/training/components/SortableExerciseList.tsx src/features/training/pages/WorkoutTemplateEditorPage* src/features/training/pages/TrainingHomePage*
git commit -m "feat(training): add templates and training dashboard"
```

## Task 8: Active Workout Experience

**Files:**
- Create: `src/features/training/components/WorkoutSetRow.tsx`
- Create: `src/features/training/pages/ActiveWorkoutPage.tsx`
- Test: `src/features/training/pages/ActiveWorkoutPage.test.tsx`

- [ ] **Step 1: Write failing active-workout tests**

Cover reload/continue, prefilled prior values, set completion, rating hidden mode, add/delete set, add/remove/reorder exercise, grip persistence, note persistence and explicit clearing, pull-up/dip modes, finish, and discard confirmations.

- [ ] **Step 2: Build mobile set rows**

Each row has visible labels and numeric inputs:

```tsx
<input aria-label={`Satz ${index + 1} Gewicht`} inputMode="decimal" />
<input aria-label={`Satz ${index + 1} Wiederholungen`} inputMode="numeric" />
<select aria-label={`Satz ${index + 1} Bewertung`}>...</select>
<input aria-label={`Satz ${index + 1} abgeschlossen`} type="checkbox" />
```

Hide the rating control when disabled, but preserve existing stored ratings. For bodyweight mode hide weight; for added show `Zusatzgewicht`; for assisted show `Unterstützung`.

- [ ] **Step 3: Autosave every relevant edit**

Every set, note, grip, load mode, exercise order, addition, and deletion must dispatch a state mutation immediately. No separate manual save button for an active workout.

- [ ] **Step 4: Finish and discard flows**

Finishing creates a `CompletedWorkout`, clears `activeWorkout`, and navigates to the completed detail. Discarding clears only `activeWorkout`. Both use `ResponsiveDialog`; discard is destructive.

- [ ] **Step 5: Run tests**

```bash
npm test -- src/features/training/pages/ActiveWorkoutPage.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/training/components/WorkoutSetRow.tsx src/features/training/pages/ActiveWorkoutPage*
git commit -m "feat(training): add offline active workout flow"
```

## Task 9: History, Editing, Deletion, and Recommendations

**Files:**
- Create: `src/features/training/pages/WorkoutHistoryPage.tsx`
- Create: `src/features/training/pages/CompletedWorkoutPage.tsx`
- Test: `src/features/training/pages/CompletedWorkoutPage.test.tsx`

- [ ] **Step 1: Write failing history tests**

Cover reverse chronological order, exercise and set details, edit all fields, save replacement, delete confirmation, and recommendation recalculation after edit/delete.

- [ ] **Step 2: Implement immutable replacement editing**

Open a mutable draft copied from the completed workout. `Save` validates and replaces the matching workout by ID without changing `id`, `startedAt`, or `completedAt`. Cancel discards the draft.

- [ ] **Step 3: Display recommendations**

Show a compact non-blocking card only when `getProgressionRecommendation` returns a value:

```text
Steigerung möglich
Du hast 80 kg im Zielbereich wiederholt erreicht. Vorschlag für das nächste Training: 82,5 kg.
```

For assisted exercises say `Weniger Unterstützung ausprobieren: 22,5 kg`.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/features/training/pages/CompletedWorkoutPage.test.tsx src/features/training/model/progression.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/features/training/pages/WorkoutHistoryPage.tsx src/features/training/pages/CompletedWorkoutPage*
git commit -m "feat(training): add editable workout history"
```

## Task 10: Settings, Corruption Recovery, Styling, and Offline Verification

**Files:**
- Create: `src/features/training/TrainingSettings.tsx`
- Create: `src/features/training/components/TrainingRecoveryDialog.tsx`
- Modify: `src/features/settings/PersonalSettings.tsx`
- Create: `src/features/training/training.css`
- Modify: `src/pwa/pwaConfig.ts`
- Test: `src/features/training/TrainingSettings.test.tsx`
- Test: `tests/e2e/training.spec.ts`

- [ ] **Step 1: Write settings tests**

Cover rating visibility, progression toggle, successful workout count constrained to 2–5, maximum average rating constrained to 1–10, increment constrained to positive 0.5 kg steps, persistence, and no Supabase calls.

- [ ] **Step 2: Add a Training settings card**

Place it after the existing appearance/mobile-navigation cards. Use visible labels and exact defaults `3`, `8`, `2.5`. Disable dependent controls when progression is off.

- [ ] **Step 3: Add corruption recovery**

When `TrainingDataCorruptionError` occurs, block training mutations and show a dialog with:
- `Rohdaten exportieren` downloads the untouched raw JSON.
- `Trainingsbereich zurücksetzen` requires confirmation and calls `repository.reset(profileId)`.
- `Abbrechen` leaves data untouched.

- [ ] **Step 4: Add mobile-first CSS**

Use existing design tokens. Minimum interactive target height: 44 px. At widths below 768 px use one-column cards and sticky bottom actions for active workout. At desktop widths use a max content width and two-column library grid. Ensure 200% text zoom does not cause horizontal page overflow.

- [ ] **Step 5: Confirm PWA precache coverage**

Keep SVG in `globPatterns` and add WebP for custom fallback assets if used:

```ts
globPatterns: ['**/*.{js,css,html,svg,webp,woff2}']
```

Standard exercise assets must be same-origin and require no runtime cache rule.

- [ ] **Step 6: Add Playwright flows**

On `iphone-webkit`: create an Oberkörper template, add Bankdrücken and Latziehen, verify `3 × 8–12`, start, enter and complete sets, reload, continue, add note and grip, finish, edit history, and delete after confirmation.

Add a production-preview offline check: load `/training` once, wait for service-worker control, set the browser context offline, reload, and verify the catalog and existing active workout render. Do not assert push or background behavior.

- [ ] **Step 7: Run focused and full verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run test:e2e
```

Expected: zero lint errors, zero TypeScript errors, zero unit/component failures, successful build/security scan, and all non-environment-skipped Playwright tests passing.

- [ ] **Step 8: Audit scope and repository state**

```bash
git diff --check
git status --short
git diff --stat main...HEAD
```

Confirm no Supabase files, secrets, account logic, calendar behavior, unrelated features, `debug.log`, or `graphify-out/` are included.

- [ ] **Step 9: Commit**

```bash
git add src/features/training src/features/settings/PersonalSettings.tsx src/pwa/pwaConfig.ts tests/e2e/training.spec.ts
git commit -m "feat(training): complete offline training phase one"
```

## Task 11: Final Review and Pull Request

**Files:**
- Modify only files required to fix verified defects from the review.

- [ ] **Step 1: Rebase or fast-forward from current `origin/main` before final review**

```bash
git fetch origin
git rebase origin/main
```

Resolve conflicts without dropping training tests or unrelated upstream changes.

- [ ] **Step 2: Run the complete verification again after the rebase**

```bash
npm ci
npm run check
npm run security:scan
npm run test:e2e
```

- [ ] **Step 3: Review against every acceptance criterion in the design spec**

Verify all ten criteria under `docs/superpowers/specs/2026-07-26-training-phase-1-design.md`, plus offline assets, accessibility labels, profile isolation, and exactly one active workout.

- [ ] **Step 4: Create the pull request**

```bash
git push -u origin feature/training-phase-1
gh pr create \
  --base main \
  --head feature/training-phase-1 \
  --title "feat: add offline training tracker" \
  --body "Implements Training Phase 1 from the approved design and implementation plan. All data remains local; no Supabase or notification changes."
```

Do not merge in this task. Report the PR URL, head SHA, verification results, changed-file summary, and any intentionally skipped environment-dependent test.

---

## Self-Review Checklist

- Every Phase 1 requirement maps to a task above.
- The 50-exercise list contains exactly 50 unique IDs and all user-required exercises.
- `TrainingState`, repository methods, provider actions, and route names are consistent across tasks.
- No Phase 2 item is included.
- No placeholders such as TBD or TODO remain.
- The implementation remains local-only and profile-scoped.
- The plan requires TDD, focused tests, frequent commits, full verification, and a PR without automatic merge.
