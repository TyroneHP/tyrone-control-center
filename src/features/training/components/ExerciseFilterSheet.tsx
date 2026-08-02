/* eslint-disable react-refresh/only-export-components -- the filter model is shared by the wizard and library. */
import { TrainingBottomSheet } from './ui/TrainingBottomSheet'
import { TrainingChip } from './ui/TrainingChip'
import type { TrainingDemoExercise } from '../demo/trainingDemoTypes'

export interface ExerciseFilters {
  favoritesOnly: boolean
  muscle: string | null
  equipment: string | null
}

export const emptyExerciseFilters: ExerciseFilters = {
  favoritesOnly: false,
  muscle: null,
  equipment: null,
}

export function deriveExerciseFilterOptions(exercises: readonly TrainingDemoExercise[]) {
  return {
    muscles: [...new Set(exercises.map(({ muscle }) => muscle))].sort((left, right) => left.localeCompare(right, 'de')),
    equipment: [...new Set(exercises.flatMap((exercise) => exercise.equipment.split(', ')))].sort((left, right) => left.localeCompare(right, 'de')),
  }
}

export function filterDemoExercises<T extends { id: string; name: string; muscle: string; equipment: string }>(
  exercises: readonly T[],
  filters: ExerciseFilters,
  favoriteIds: readonly string[],
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase('de-DE')
  return exercises.filter((exercise) =>
    (!needle || exercise.name.toLocaleLowerCase('de-DE').includes(needle)) &&
    (!filters.favoritesOnly || favoriteIds.includes(exercise.id)) &&
    (!filters.muscle || exercise.muscle === filters.muscle) &&
    (!filters.equipment || exercise.equipment.split(', ').includes(filters.equipment)),
  )
}

export interface ExerciseFilterSheetProps {
  exercises: readonly TrainingDemoExercise[]
  filters: ExerciseFilters
  onChange: (filters: ExerciseFilters) => void
  onClose: () => void
  open: boolean
}

export function ExerciseFilterSheet({ exercises, filters, onChange, onClose, open }: ExerciseFilterSheetProps) {
  const update = (changes: Partial<ExerciseFilters>) => onChange({ ...filters, ...changes })
  const options = deriveExerciseFilterOptions(exercises)
  return (
    <TrainingBottomSheet onClose={onClose} open={open} title="Übungen filtern">
      <section aria-label="Muskelgruppen">
        <h2>Muskelgruppe</h2>
        {options.muscles.map((muscle) => <TrainingChip key={muscle} onClick={() => update({ muscle: filters.muscle === muscle ? null : muscle })} selected={filters.muscle === muscle}>{muscle} filtern</TrainingChip>)}
      </section>
      <section aria-label="Ausrüstung">
        <h2>Ausrüstung</h2>
        {options.equipment.map((item) => <TrainingChip key={item} onClick={() => update({ equipment: filters.equipment === item ? null : item })} selected={filters.equipment === item}>{item} filtern</TrainingChip>)}
      </section>
      <TrainingChip onClick={() => update({ favoritesOnly: !filters.favoritesOnly })} selected={filters.favoritesOnly}>Nur Favoriten</TrainingChip>
      <button onClick={() => onChange(emptyExerciseFilters)} type="button">Filter zurücksetzen</button>
    </TrainingBottomSheet>
  )
}
