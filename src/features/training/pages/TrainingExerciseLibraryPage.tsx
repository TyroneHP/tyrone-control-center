import { useState } from 'react'
import { ExerciseFilterSheet, emptyExerciseFilters, filterDemoExercises } from '../components/ExerciseFilterSheet'
import { TrainingBottomSheet } from '../components/ui/TrainingBottomSheet'
import { useTrainingDemo } from '../demo/useTrainingDemo'

export function TrainingExerciseLibraryPage() {
  const { state, toggleFavoriteExercise } = useTrainingDemo()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyExerciseFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const exercises = filterDemoExercises(state.exercises, filters, state.favoriteExerciseIds, search)
  const selected = state.exercises.find((exercise) => exercise.id === selectedId)
  return (
    <main aria-labelledby="training-library-heading">
      <h1 id="training-library-heading">Übungsbibliothek</h1>
      <label>
        Übungen suchen
        <input aria-label="Übungen suchen" onChange={(event) => setSearch(event.target.value)} role="searchbox" type="search" value={search} />
      </label>
      <button onClick={() => setFiltersOpen(true)} type="button">Filter öffnen</button>
      <p aria-live="polite">{exercises.length} Übungen</p>
      <ul className="training-list">
        {exercises.map((exercise) => {
          const favorite = state.favoriteExerciseIds.includes(exercise.id)
          return <li className="compact-exercise-row" key={exercise.id}>
            <button aria-label={`Übung öffnen: ${exercise.name}`} onClick={() => setSelectedId(exercise.id)} type="button">
              <img alt="" aria-hidden="true" className="compact-exercise-row__illustration" src={`${import.meta.env.BASE_URL}${exercise.illustrationPath}`} />
              <span><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.equipment}</small></span>
            </button>
            <button aria-label={`${exercise.name} ${favorite ? 'aus Favoriten entfernen' : 'zu Favoriten hinzufügen'}`} onClick={() => toggleFavoriteExercise(exercise.id)} type="button">{favorite ? '★' : '☆'}</button>
          </li>
        })}
      </ul>
      <ExerciseFilterSheet exercises={state.exercises} filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} open={filtersOpen} />
      <TrainingBottomSheet onClose={() => setSelectedId(null)} open={Boolean(selected)} title={selected?.name ?? 'Übung'}>
        {selected ? <><img alt={`Technische Darstellung: ${selected.name}`} src={`${import.meta.env.BASE_URL}${selected.illustrationPath}`} /><p>{selected.muscle} · {selected.equipment}</p></> : null}
      </TrainingBottomSheet>
    </main>
  )
}
