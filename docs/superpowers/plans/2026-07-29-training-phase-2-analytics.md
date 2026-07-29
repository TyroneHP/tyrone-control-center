# Training Phase 2 Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing offline training tracker with local progress analytics, records, muscle-group insights, body-weight tracking, historical bodyweight-load snapshots, and accessible charts.

**Architecture:** Upgrade the existing IndexedDB state from schema/database version 1 to 2 without replacing its stores. Persist only source data, snapshots, and user preferences; derive records, chart series, heatmaps, muscle totals, and dashboard metrics through pure modules. Render dependency-free local SVG charts plus accessible value lists.

**Tech Stack:** React 19, TypeScript 6 strict mode, React Router 7, Zod 4, idb 8, Vitest 4, Testing Library, Playwright, Vite 8, existing CoreGrid design tokens and CSS.

## Global Constraints

- Training data stays exclusively in the existing local IndexedDB database and is never sent to Supabase.
- Preserve every recoverable Phase-1 plan, workout, active session, note, favorite, custom exercise, image, and preference.
- Do not add Supabase, server-database, Edge Function, secret, push, reminder, pause-timer, Health-platform, import, social, AI-plan, or external-image functionality.
- Do not change working Phase-1 behavior unless the version-2 schema or historical snapshots require it.
- All visible copy is German; code, types, file names, and commit messages are English.
- Mobile layouts retain global bottom navigation, desktop sidebar, safe-area spacing, visible focus, keyboard access, and 44-pixel touch targets.
- No external runtime API or asset is allowed; the complete progress area must work offline through the existing PWA bundle.
- Use TDD for every task: RED test, confirmed failure, minimal GREEN implementation, focused verification, then commit.
- Do not modify `debug.log`, `graphify-out/`, Supabase files, or unrelated application areas.

---

## File Responsibilities

- `model/trainingTypes.ts`, `trainingSchemas.ts`, `trainingDefaults.ts`: persisted version-2 model and validation.
- `persistence/trainingMigrations.ts`, `indexedDbTrainingRepository.ts`: lossless v1-to-v2 migration and DB-version upgrade.
- `model/bodyWeightModel.ts`, `model/workoutModel.ts`: immutable source-data operations and snapshot lifecycle.
- `analytics/*.ts`: pure local-day, load, trend, record, muscle, insight, heatmap, and dashboard calculations.
- `TrainingProvider.tsx`, `trainingContext.ts`: serialized persistence mutations and rollback behavior.
- `components/TrainingNavigation.tsx`, `ProgressNavigation.tsx`, `AnalyticsPeriodFilter.tsx`: route navigation and shared filters.
- `components/LineChart.tsx`, `BarChart.tsx`, `TrainingHeatmap.tsx`: accessible dependency-free visualizations.
- `pages/*AnalyticsPage.tsx`, `ProgressDashboardPage.tsx`, `BodyWeightPage.tsx`: progress views.
- `routes/router.tsx`: protected progress routes.
- `training.css`: responsive Slate/Orange layouts.
- `tests/e2e/training-analytics.spec.ts`, `docs/training.md`: product journey and technical documentation.

---

### Task 1: Version-2 model and lossless migration

**Files:**
- Modify: `src/features/training/model/trainingTypes.ts`
- Modify: `src/features/training/model/trainingSchemas.ts`
- Modify: `src/features/training/model/trainingDefaults.ts`
- Modify: `src/features/training/model/workoutModel.ts`
- Modify: `src/features/training/model/workoutModel.test.ts`
- Modify: `src/features/training/persistence/trainingMigrations.ts`
- Modify: `src/features/training/persistence/indexedDbTrainingRepository.ts`
- Test: `src/features/training/model/trainingSchemas.test.ts`
- Test: `src/features/training/persistence/indexedDbTrainingRepository.test.ts`
- Modify: existing training test fixtures that construct workout exercise entries

**Interfaces:**
- Produces `ExerciseSnapshot`, `BodyWeightEntry`, `BodyWeightSnapshot`, `AnalyticsRangeSelection`, `AnalyticsPreferences`, and `TrainingState` with `schemaVersion: 2`.
- Keeps every `TrainingRepository` method signature unchanged.

- [ ] **Step 1: Write RED schema and migration tests**

Create a realistic version-1 fixture with template, active workout, completed workout, note, grip, custom exercise, favorite and preferences. Store a custom image in the raw `images` store. Assert that migration preserves every original value, creates snapshots, adds empty body weights/preferences once, and preserves image bytes after opening database version 2.

```ts
expect(migrated).toMatchObject({
  schemaVersion: 2,
  bodyWeightEntries: [],
  analyticsPreferences: {
    range: { preset: '30d' },
    exerciseMetric: 'weight',
    muscleMetric: 'sets',
    dismissedBalanceInsightIds: [],
  },
})
expect(migrated.completedWorkouts[0].exercises[0].exerciseSnapshot.name)
  .toBe('Bankdrücken')
```

- [ ] **Step 2: Confirm RED**

Run `npx.cmd vitest run src/features/training/model/trainingSchemas.test.ts src/features/training/persistence/indexedDbTrainingRepository.test.ts`.

Expected: compilation or assertion failures because version 2 and snapshots do not exist.

- [ ] **Step 3: Implement strict version-2 persisted types**

Add these contracts and equivalent strict Zod schemas:

```ts
interface ExerciseSnapshot {
  exerciseId: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  unit: ExerciseUnit
  supportsBodyweightModes: boolean
}
interface BodyWeightSnapshot {
  weightKg: number
  sourceDate: string
  capturedAt: string
}
interface BodyWeightEntry {
  id: string
  date: string
  weightKg: number
  note: string
  createdAt: string
  updatedAt: string
}
type AnalyticsRangeSelection =
  | { preset: '7d' | '30d' | '3m' | '6m' | '1y' | 'all' }
  | { preset: 'custom'; startDate: string; endDate: string }
```

Make `exerciseSnapshot` required and `bodyWeightSnapshot` optional on workout exercise entries. Validate unique body-weight dates/IDs, canonical local dates, 20–500 kg and at most two decimals.

- [ ] **Step 4: Implement v1-to-v2 and IndexedDB migration**

Combine `STANDARD_EXERCISES` with version-1 custom definitions for snapshot lookup. Map active/completed exercises without changing IDs, order, sets, notes, grips, modes or timestamps. Use a neutral fallback snapshot with empty muscles only when deleted custom metadata is unrecoverable. Bump `DATABASE_VERSION` to 2 and create stores only when absent.

Update `workoutModel` in the same task so newly started and newly extended active workouts immediately receive the required catalog snapshot. Update existing typed fixtures with explicit snapshots or a shared test factory; do not make the persisted field optional merely to satisfy compilation.

```ts
upgrade(database) {
  if (!database.objectStoreNames.contains('states')) database.createObjectStore('states')
  if (!database.objectStoreNames.contains('images')) database.createObjectStore('images')
}
```

- [ ] **Step 5: Confirm GREEN and commit**

Run focused tests plus `npm.cmd run typecheck`, then commit `feat(training): migrate local analytics schema`.

### Task 2: Local date ranges

**Files:**
- Create: `src/features/training/analytics/dateRangeAnalytics.ts`
- Create: `src/features/training/analytics/dateRangeAnalytics.test.ts`

**Interfaces:**
- `toLocalDateKey(value: Date | string): string`
- `resolveAnalyticsRange(selection, today, availableDates): DateRangeResult`
- `isDateKeyInRange(dateKey, range): boolean`

- [ ] **Step 1: Write RED tests**

Cover 7/30 days, 3/6/12 calendar months, all data, custom inclusive bounds, invalid order, end-of-month clamping and UTC/local-midnight crossings.

```ts
expect(resolveAnalyticsRange({ preset: '7d' }, localNoon('2026-07-29'), []))
  .toEqual({ valid: true, range: { startDate: '2026-07-23', endDate: '2026-07-29' } })
```

- [ ] **Step 2: Confirm RED**

Run `npx.cmd vitest run src/features/training/analytics/dateRangeAnalytics.test.ts` and expect a missing-module failure.

- [ ] **Step 3: Implement**

Use local date fields, local-noon calendar arithmetic, inclusive ISO date-key comparison and the oldest available date for `all`. Never filter workout timestamps by UTC substring.

- [ ] **Step 4: Confirm GREEN and commit**

Run the focused test and commit `feat(training): add local analytics date ranges`.

### Task 3: Body-weight source model and seven-day trend

**Files:**
- Create: `src/features/training/model/bodyWeightModel.ts`
- Create: `src/features/training/model/bodyWeightModel.test.ts`
- Create: `src/features/training/analytics/bodyWeightAnalytics.ts`
- Create: `src/features/training/analytics/bodyWeightAnalytics.test.ts`

**Interfaces:**
- `BodyWeightDateConflictError`
- `upsertBodyWeightEntry`, `moveBodyWeightEntry`, `deleteBodyWeightEntry`, `findBodyWeightForWorkoutDate`
- `getBodyWeightSummary(entries, range)`, `getSevenDayBodyWeightTrend(entries, range)`

- [ ] **Step 1: Write RED model tests**

Assert one entry per day, same-day update retaining stable ID/createdAt, date move, collision, deletion, exact-date lookup, previous fallback and rejection of later entries.

- [ ] **Step 2: Write RED analytics tests**

Assert current/first/min/max/count, period change, change from immediately previous measurement and seven-calendar-day averages that ignore missing days.

```ts
expect(getSevenDayBodyWeightTrend(entries, range)).toEqual([
  { date: '2026-07-01', rawKg: 80, averageKg: 80 },
  { date: '2026-07-07', rawKg: 78, averageKg: 79 },
  { date: '2026-07-09', rawKg: 77, averageKg: 77.5 },
])
```

- [ ] **Step 3: Confirm RED, implement and confirm GREEN**

Run both files, implement immutable date-key operations and undefined missing metrics, then rerun them.

- [ ] **Step 4: Commit**

Commit `feat(training): add local body weight analytics`.

### Task 4: Total load, volume and Epley 1RM

**Files:**
- Create: `src/features/training/analytics/loadAnalytics.ts`
- Create: `src/features/training/analytics/loadAnalytics.test.ts`

**Interfaces:**
- `getSetLoadKg(exercise, set): number | undefined`
- `getSetVolume(exercise, set): number | undefined`
- `estimateOneRepMax(exercise, set): number | undefined`
- `roundAnalyticsValue(value, digits?): number`

- [ ] **Step 1: Write RED boundary tests**

Cover normal/incomplete/invalid sets, reps 0/1/12/13, weightless exercises, bodyweight/added/assisted modes, assistance above body weight and missing snapshots.

```ts
expect(estimateOneRepMax(weightedExercise, completedSet(100, 12))).toBe(140)
expect(estimateOneRepMax(weightedExercise, completedSet(100, 13))).toBeUndefined()
expect(getSetLoadKg(assistedPullUp(80), completedSet(90, 8))).toBe(0)
```

- [ ] **Step 2: Confirm RED**

Run the new test and expect a missing-module failure.

- [ ] **Step 3: Implement and confirm GREEN**

Use completed sets only, entered kg for normal weighted exercises and immutable snapshots for bodyweight modes. Clamp assisted load to zero, apply Epley only at 1–12 reps and retain raw precision.

- [ ] **Step 4: Commit**

Commit `feat(training): calculate load volume and one rep max`.

### Task 5: Exercise series and reproducible records

**Files:**
- Create: `src/features/training/analytics/exerciseAnalytics.ts`
- Create: `src/features/training/analytics/exerciseAnalytics.test.ts`
- Create: `src/features/training/analytics/recordAnalytics.ts`
- Create: `src/features/training/analytics/recordAnalytics.test.ts`

**Interfaces:**
- `getExerciseSeries(workouts, exerciseId, metric, range): ExerciseDataPoint[]`
- `getExerciseRecords(workouts, range?): ExerciseRecordSummary[]`
- `getExerciseRecordHistory(workouts, exerciseId, range?): RecordHistoryEntry[]`
- Points retain workout/exercise/set IDs, date, name, grip, rating and raw set values.

- [ ] **Step 1: Write RED aggregation tests**

Assert highest weight/reps/1RM, summed volume per workout, chronological sorting, range filtering, custom/deleted snapshots and point detail metadata.

- [ ] **Step 2: Write RED record tests**

Assert first record, strict improvement, ignored ties, all three record kinds, historical editing/deletion, next-best promotion, complete improvement history and bodyweight-load records.

- [ ] **Step 3: Confirm RED, implement and confirm GREEN**

Sort by completion time and stable original position. Evaluate sets through `loadAnalytics`; append history only for numeric `candidate > current`. Run both focused files.

- [ ] **Step 4: Commit**

Commit `feat(training): derive exercise trends and records`.

### Task 6: Muscle groups, balance insights, heatmap and dashboard metrics

**Files:**
- Create: `src/features/training/analytics/muscleGroupAnalytics.ts`
- Create: `src/features/training/analytics/muscleGroupAnalytics.test.ts`
- Create: `src/features/training/analytics/balanceInsightAnalytics.ts`
- Create: `src/features/training/analytics/balanceInsightAnalytics.test.ts`
- Create: `src/features/training/analytics/heatmapAnalytics.ts`
- Create: `src/features/training/analytics/heatmapAnalytics.test.ts`
- Create: `src/features/training/analytics/dashboardAnalytics.ts`
- Create: `src/features/training/analytics/dashboardAnalytics.test.ts`

**Interfaces:**
- `getMuscleGroupAnalytics(workouts, range): MuscleGroupResult[]`
- `BALANCE_INSIGHT_THRESHOLDS`, `getBalanceInsights(workouts, muscleGroups, dismissedIds)`
- `getTrainingHeatmap(workouts, range): HeatmapDay[]`
- `getDashboardMetrics(workouts, bodyWeights, range): DashboardMetrics`

- [ ] **Step 1: Write RED muscle tests**

Assert primary 1.0/100%, every secondary 0.5/50%, multiple muscles, weightless set counts, zero weightless volume, exercise contributions and historical snapshot metadata.

- [ ] **Step 2: Write RED insight tests**

Assert no hint below five complete workouts, exactly five qualifies, incomplete sessions do not count, the 50%/eight-set thresholds, dismissed IDs, stable IDs and neutral non-medical copy.

- [ ] **Step 3: Write RED heatmap/dashboard tests**

Assert multiple workouts per local day, completed-set intensity, complete/incomplete status, period filtering, duration, frequency, weekly average, record count, body-weight change and `undefined` for unavailable metrics.

- [ ] **Step 4: Confirm RED, implement and confirm GREEN**

Define a fully complete workout as at least one exercise and at least `targetSets` completed sets for every exercise. Count all historical sessions for dashboard frequency, but only fully complete sessions for balance minimum. Keep all workout references in each heatmap day.

- [ ] **Step 5: Commit**

Commit `feat(training): add dashboard and muscle analytics`.

### Task 7: Snapshot-aware workout lifecycle and provider mutations

**Files:**
- Modify: `src/features/training/model/workoutModel.ts`
- Modify: `src/features/training/model/workoutModel.test.ts`
- Modify: `src/features/training/model/bodyWeightModel.ts`
- Modify: `src/features/training/model/bodyWeightModel.test.ts`
- Modify: `src/features/training/trainingContext.ts`
- Modify: `src/features/training/TrainingProvider.tsx`
- Modify: `src/features/training/TrainingProvider.test.tsx`

**Interfaces:**
- Context adds `saveBodyWeightEntry`, `moveBodyWeightEntry`, `deleteBodyWeightEntry`, `updateAnalyticsPreferences`, `dismissBalanceInsight`, and `refreshWorkoutBodyWeightSnapshots`.
- Completing a workout captures eligible body-weight snapshots and removes the active session in one persisted state change.

- [ ] **Step 1: Write RED lifecycle tests**

Assert exact/earlier/no/later body weight at completion, stability after source edits, one-time missing-snapshot backfill, explicit refresh, custom-exercise deletion/change stability and preserved snapshots during historical editing.

- [ ] **Step 2: Write RED provider tests**

Assert serialized save, same-day upsert, move conflict without data loss, delete rollback, preference/dismiss persistence, snapshot backfill, profile isolation and reset clearing Phase-2 source data.

- [ ] **Step 3: Confirm RED**

Run the model/provider files and record missing API/type failures.

- [ ] **Step 4: Implement minimal lifecycle changes**

Resolve body weight from the local workout day at completion. Preserve exercise and body-weight snapshots through normal edits. After weight saves, backfill only missing body-weight snapshots and never overwrite an existing snapshot automatically.

- [ ] **Step 5: Implement provider API and confirm GREEN**

Route every mutation through existing `updateState` and save queues. Use targeted rollback for moves/deletes and surface `BodyWeightDateConflictError` without closing the form. Run focused tests and typecheck.

- [ ] **Step 6: Commit**

Commit `feat(training): persist body weight and workout snapshots`.

### Task 8: Protected progress routes and internal navigation

**Files:**
- Create: `src/features/training/components/TrainingNavigation.tsx`
- Create: `src/features/training/components/TrainingNavigation.test.tsx`
- Create: `src/features/training/components/ProgressNavigation.tsx`
- Create: `src/features/training/pages/ProgressDashboardPage.tsx`
- Create: `src/features/training/pages/ExerciseAnalyticsPage.tsx`
- Create: `src/features/training/pages/RecordAnalyticsPage.tsx`
- Create: `src/features/training/pages/MuscleGroupAnalyticsPage.tsx`
- Create: `src/features/training/pages/BodyWeightPage.tsx`
- Modify: `src/routes/router.tsx`
- Modify: `src/routes/router.test.tsx`
- Modify: existing training pages to include `TrainingNavigation`

**Interfaces:**
- Adds protected `/training/progress`, `/training/progress/exercises`, `/records`, `/muscles` and `/bodyweight` routes.
- Exercise selection uses `?exercise=<id>` for reloadable deep links.

- [ ] **Step 1: Write RED navigation tests**

Assert five primary links, five progress links, `aria-current`, direct protected routing, browser-back behavior through MemoryRouter and unchanged global shell navigation.

- [ ] **Step 2: Confirm RED**

Run navigation/router tests and confirm routes/components are absent.

- [ ] **Step 3: Implement navigation and route shells**

Use semantic `nav` lists and `NavLink`. Keep all routes inside `ProtectedShell`. Page shells use German headings and honest empty states.

- [ ] **Step 4: Confirm GREEN and commit**

Run focused tests and commit `feat(training): add protected progress navigation`.

### Task 9: Accessible charts and shared period filter

**Files:**
- Create: `src/features/training/components/AnalyticsPeriodFilter.tsx`
- Create: `src/features/training/components/AnalyticsPeriodFilter.test.tsx`
- Create: `src/features/training/components/LineChart.tsx`
- Create: `src/features/training/components/LineChart.test.tsx`
- Create: `src/features/training/components/BarChart.tsx`
- Create: `src/features/training/components/BarChart.test.tsx`
- Create: `src/features/training/components/TrainingHeatmap.tsx`
- Create: `src/features/training/components/TrainingHeatmap.test.tsx`
- Modify: `src/features/training/training.css`

**Interfaces:**
- Period filter emits only valid persisted selections.
- Line/bar charts receive labeled numeric data and selection callbacks.
- Heatmap receives `HeatmapDay[]` and selects one local date.

- [ ] **Step 1: Write RED accessibility tests**

Assert preset/custom validation, accessible labels, keyboard/touch selection, non-color status, empty series, tooltip content, complete value lists and 44-pixel controls.

- [ ] **Step 2: Confirm RED**

Run all four component tests and confirm missing modules.

- [ ] **Step 3: Implement local SVG and heatmap components**

Use responsive `viewBox`, `<title>/<desc>`, focusable controls, CoreGrid tokens and explicit selected states. Keep all values in an accessible list. Above 500 visual line points, retain first/last and every bucket minimum/maximum while keeping the list complete.

- [ ] **Step 4: Confirm GREEN and commit**

Run focused tests and lint, then commit `feat(training): add accessible analytics charts`.

### Task 10: Progress dashboard, heatmap details and balance guidance

**Files:**
- Modify: `src/features/training/pages/ProgressDashboardPage.tsx`
- Create: `src/features/training/pages/ProgressDashboardPage.test.tsx`
- Modify: `src/features/training/training.css`

**Interfaces:**
- Consumes dashboard, heatmap, muscle, record and insight modules.
- Persists shared period and dismissed insight IDs through context.

- [ ] **Step 1: Write RED page tests**

Assert available metrics, missing-data labels, period changes, invalid custom range, quick links, multi-workout day dialog, complete/incomplete status, history links, insight minimum and dismissal persistence.

- [ ] **Step 2: Confirm RED**

Run the dashboard test and confirm the route shell lacks the required content.

- [ ] **Step 3: Implement memoized dashboard composition**

Resolve one period for all calculations. Use `ResponsiveDialog` for day details. Display `Keine Messdaten` rather than numeric zero when body weight or duration cannot be derived.

- [ ] **Step 4: Confirm GREEN and commit**

Run tests/lint and commit `feat(training): build progress dashboard`.

### Task 11: Exercise analysis and compact exercise details

**Files:**
- Modify: `src/features/training/pages/ExerciseAnalyticsPage.tsx`
- Create: `src/features/training/pages/ExerciseAnalyticsPage.test.tsx`
- Create: `src/features/training/components/ExerciseProgressSummary.tsx`
- Create: `src/features/training/components/ExerciseProgressSummary.test.tsx`
- Modify: `src/features/training/components/ExercisePickerDialog.tsx`
- Modify: `src/features/training/components/ExercisePickerDialog.test.tsx`
- Modify: `src/features/training/training.css`

**Interfaces:**
- Supports current catalog plus unique historical snapshots.
- Switches weight/reps/volume/1RM and persists the metric.
- Compact summary links to the reloadable exercise-analysis URL.

- [ ] **Step 1: Write RED analysis tests**

Assert search, primary-muscle filtering, favorites-first option, inherited period, metric switch, empty states, point details with set/rating/grip/history link and unsupported metric exclusions.

- [ ] **Step 2: Write RED summary tests**

Assert applicable current records, omitted unsupported records, latest trend, small chart, no broken empty chart and full-analysis link.

- [ ] **Step 3: Confirm RED, implement and confirm GREEN**

Build the exercise list from catalog and historical snapshots; use historical metadata for deleted or renamed items. Show one main chart and point details in `ResponsiveDialog`. Run all focused tests and typecheck.

- [ ] **Step 4: Commit**

Commit `feat(training): add exercise progress analysis`.

### Task 12: Record overview and muscle drilldown

**Files:**
- Modify: `src/features/training/pages/RecordAnalyticsPage.tsx`
- Create: `src/features/training/pages/RecordAnalyticsPage.test.tsx`
- Modify: `src/features/training/pages/MuscleGroupAnalyticsPage.tsx`
- Create: `src/features/training/pages/MuscleGroupAnalyticsPage.test.tsx`
- Modify: `src/features/training/training.css`

**Interfaces:**
- Records filter by type, historical muscle and exercise query.
- Muscles switch sets/volume, drill into contributions and link to exercise analysis.

- [ ] **Step 1: Write RED record-page tests**

Assert prominent current records, type/muscle/search filters, chronological improvement history, previous values, workout/set references and recalculation from changed state.

- [ ] **Step 2: Write RED muscle-page tests**

Assert metric switch, sorted bars/list, values/shares, weighting explanation, group details, weightless behavior and analysis links.

- [ ] **Step 3: Confirm RED, implement and confirm GREEN**

Keep lifetime current records distinct from period-filtered discovery/history and label that distinction in German. Run both test files.

- [ ] **Step 4: Commit**

Commit `feat(training): add record and muscle views`.

### Task 13: Body-weight UI and historical snapshot refresh

**Files:**
- Modify: `src/features/training/pages/BodyWeightPage.tsx`
- Create: `src/features/training/pages/BodyWeightPage.test.tsx`
- Modify: `src/features/training/pages/CompletedWorkoutPage.tsx`
- Modify: `src/features/training/pages/CompletedWorkoutPage.test.tsx`
- Modify: `src/features/training/training.css`

**Interfaces:**
- Body-weight form creates or updates one entry per day and reports move conflicts.
- Completed workout exposes explicit `Körpergewicht neu bestimmen` for bodyweight-mode exercises.

- [ ] **Step 1: Write RED body-weight tests**

Assert add, same-day update, date edit/conflict, delete confirmation, summary, raw/trend legend, point note, period filtering, German validation, empty state and write-error recovery.

- [ ] **Step 2: Write RED snapshot-refresh tests**

Assert missing-snapshot warning, explicit exact/earlier refresh, stability after source edit, refusal of later weight and displayed total load.

- [ ] **Step 3: Confirm RED, implement and confirm GREEN**

Use `ResponsiveDialog`, date input, `inputMode="decimal"`, accessible errors and confirmation. Never refresh a snapshot during render. Run both page tests and lint.

- [ ] **Step 4: Commit**

Commit `feat(training): add body weight tracking`.

### Task 14: Phase-1 regression, responsive and offline coverage

**Files:**
- Modify: `src/features/training/training.css`
- Modify: `src/pwa/pwaConfig.test.ts` only when the existing asset glob needs a new assertion
- Modify: affected existing training tests and route tests

**Interfaces:**
- Every Phase-1 screen remains functional with version-2 fixtures.
- Existing PWA glob covers bundled Phase-2 JS/CSS without runtime caching.

- [ ] **Step 1: Add RED regression assertions**

Assert narrow-width containment, 44-pixel targets, safe-area spacing, active-workout persistence, custom images, historical edit/delete and offline static coverage.

- [ ] **Step 2: Run complete Vitest and classify failures**

Run `npm.cmd run test`. Fix only version-2 fixture, new-route or new-layout regressions. Do not weaken the schema; use shared version-2 factories.

- [ ] **Step 3: Run check and commit**

Run `npm.cmd run check` and commit `test(training): cover phase 2 regressions`.

### Task 15: E2E, documentation, full verification and pull request

**Files:**
- Create: `tests/e2e/training-analytics.spec.ts`
- Create or Modify: `docs/training.md`
- Modify: `README.md` only if it lacks a documentation link

**Interfaces:**
- E2E uses `installPreviewSession` and only browser-local test-profile data.
- Documentation is the source for formulas, migration, privacy and exclusions.

- [ ] **Step 1: Write RED E2E scenarios**

In mobile WebKit, complete a weighted workout, open progress, verify metrics, switch exercise metric, inspect records/muscles, add body weight, complete a pull-up or dip workout, reload, verify persistence, edit a historical set, verify recomputation, delete it, verify recomputation and navigate progress pages offline in a production preview.

- [ ] **Step 2: Run E2E and fix only Phase-2 failures**

Run `npm.cmd run test:e2e`. Environment-gated production-preview checks may use the existing documented skip convention; unexpected failures may not be skipped.

- [ ] **Step 3: Write documentation**

Document pure analytics/source-of-truth architecture, inclusive local ranges, exercise aggregation, Epley and 12-rep limit, volume, muscle weighting, strict records, balance thresholds, body weight, seven-day average, bodyweight load/snapshots, IndexedDB version-2 migration, offline/privacy behavior, exclusions, test commands and the no-dependency chart decision.

- [ ] **Step 4: Run complete fresh verification**

Run in order:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run security:scan
npm.cmd run test:e2e
git diff --check
git status --short --branch
```

Expected: zero lint warnings/errors, passing TypeScript/Vitest/build/security, zero unexpected Playwright failures, clean diff check and only intentional Phase-2 files. Record unchanged `npm ci` audit advisories without risky updates.

- [ ] **Step 5: Run final browser checks and capture screenshots**

Use local production preview at iPhone and desktop sizes. Verify no document overflow, readable dark charts, focus/tap tooltips, safe-area navigation, cached offline routes and no critical console or asset errors. Keep temporary screenshots outside the repository.

- [ ] **Step 6: Commit E2E and documentation**

Stage only `tests/e2e/training-analytics.spec.ts`, `docs/training.md`, and `README.md` when changed. Commit `docs(training): document phase 2 analytics`.

- [ ] **Step 7: Verify scope and secrets**

Run `git diff --name-status main...HEAD`, `npm.cmd run security:scan`, and `git status --short --branch`. Confirm no Supabase, secret, `debug.log`, or `graphify-out/` change.

- [ ] **Step 8: Push and create a non-merged pull request**

Push without force. Create a PR against `main` titled `feat: add local training analytics`. Its body lists features, IndexedDB migration, architecture, dependencies, test counts/results, audit advisories, known limitations and screenshots when available. Wait for CI and report its status; do not merge.
