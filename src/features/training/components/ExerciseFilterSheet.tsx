/* eslint-disable react-refresh/only-export-components -- the filter model is shared by the wizard and library. */
import { TrainingBottomSheet } from './ui/TrainingBottomSheet'
import { TrainingChip } from './ui/TrainingChip'

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

const muscles = ['Brust', 'Latissimus', 'Quadrizeps', 'Schultern', 'Bizeps', 'Trizeps', 'Rumpf']
const equipment = ['Langhantel', 'Kurzhanteln', 'Kabelzug', 'Latzug', 'Trainingsmatte']

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
    (!filters.muscle || exercise.muscle.includes(filters.muscle)) &&
    (!filters.equipment || exercise.equipment.includes(filters.equipment)),
  )
}

export interface ExerciseFilterSheetProps {
  filters: ExerciseFilters
  onChange: (filters: ExerciseFilters) => void
  onClose: () => void
  open: boolean
}

export function ExerciseFilterSheet({ filters, onChange, onClose, open }: ExerciseFilterSheetProps) {
  const update = (changes: Partial<ExerciseFilters>) => onChange({ ...filters, ...changes })
  return (
    <TrainingBottomSheet onClose={onClose} open={open} title="Übungen filtern">
      <section aria-label="Muskelgruppen">
        <h2>Muskelgruppe</h2>
        {muscles.map((muscle) => <TrainingChip key={muscle} onClick={() => update({ muscle: filters.muscle === muscle ? null : muscle })} selected={filters.muscle === muscle}>{muscle} filtern</TrainingChip>)}
      </section>
      <section aria-label="Ausrüstung">
        <h2>Ausrüstung</h2>
        {equipment.map((item) => <TrainingChip key={item} onClick={() => update({ equipment: filters.equipment === item ? null : item })} selected={filters.equipment === item}>{item} filtern</TrainingChip>)}
      </section>
      <TrainingChip onClick={() => update({ favoritesOnly: !filters.favoritesOnly })} selected={filters.favoritesOnly}>Nur Favoriten</TrainingChip>
      <button onClick={() => onChange(emptyExerciseFilters)} type="button">Filter zurücksetzen</button>
    </TrainingBottomSheet>
  )
}
