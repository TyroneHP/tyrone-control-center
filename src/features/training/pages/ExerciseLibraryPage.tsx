import { useEffect, useMemo, useState } from 'react'
import { ResponsiveDialog } from '../../../design-system'
import { ExerciseCard } from '../components/ExerciseCard'
import {
  ExerciseDetailsDialog,
} from '../components/ExercisePickerDialog'
import { ExerciseEditorDialog } from '../components/ExerciseEditorDialog'
import type { ExerciseDefinition } from '../model/trainingTypes'
import { useTraining } from '../useTraining'

function useCustomExerciseImageUrls(catalog: readonly ExerciseDefinition[]) {
  const { loadImage } = useTraining()
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let disposed = false
    const createdUrls: string[] = []
    const imageExercises = catalog.filter(
      (exercise) => exercise.source === 'custom' && exercise.customImageId,
    )

    void Promise.all(
      imageExercises.map(async (exercise) => {
        try {
          const blob = await loadImage(exercise.customImageId!)
          if (
            !blob ||
            disposed ||
            typeof URL.createObjectURL !== 'function' ||
            typeof URL.revokeObjectURL !== 'function'
          ) {
            return undefined
          }
          const url = URL.createObjectURL(blob)
          if (disposed) {
            URL.revokeObjectURL(url)
            return undefined
          }
          createdUrls.push(url)
          return [exercise.id, url] as const
        } catch {
          return undefined
        }
      }),
    ).then((images) => {
      if (disposed) return
      setImageUrls(
        Object.fromEntries(
          images.filter(
            (image): image is readonly [string, string] => image !== undefined,
          ),
        ),
      )
    })

    return () => {
      disposed = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [catalog, loadImage])

  return imageUrls
}

export function ExerciseLibraryPage() {
  const {
    catalog,
    deleteCustomExercise,
    state,
    toggleFavoriteExercise,
  } = useTraining()
  const imageUrls = useCustomExerciseImageUrls(catalog)
  const [query, setQuery] = useState('')
  const [primaryMuscle, setPrimaryMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition>()
  const [editingExercise, setEditingExercise] = useState<ExerciseDefinition>()
  const [deletingExercise, setDeletingExercise] = useState<ExerciseDefinition>()
  const [creatingExercise, setCreatingExercise] = useState(false)

  const primaryMuscles = useMemo(
    () =>
      [...new Set(catalog.flatMap((exercise) => exercise.primaryMuscles))].sort(
        (left, right) => left.localeCompare(right, 'de'),
      ),
    [catalog],
  )
  const equipmentOptions = useMemo(
    () =>
      [...new Set(catalog.flatMap((exercise) => exercise.equipment))].sort(
        (left, right) => left.localeCompare(right, 'de'),
      ),
    [catalog],
  )
  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de')
    return catalog.filter((exercise) => {
      if (
        normalizedQuery &&
        !exercise.name.toLocaleLowerCase('de').includes(normalizedQuery)
      ) {
        return false
      }
      if (
        primaryMuscle &&
        !exercise.primaryMuscles.includes(primaryMuscle)
      ) {
        return false
      }
      if (equipment && !exercise.equipment.includes(equipment)) return false
      return !favoritesOnly || state.favoriteExerciseIds.includes(exercise.id)
    })
  }, [catalog, equipment, favoritesOnly, primaryMuscle, query, state.favoriteExerciseIds])

  const confirmDeletion = async () => {
    if (!deletingExercise) return
    try {
      await deleteCustomExercise(deletingExercise.id)
    } catch {
      // The provider already exposes the profile-bound mutation error as a toast.
    } finally {
      setDeletingExercise(undefined)
    }
  }

  return (
    <section aria-labelledby="exercise-library-heading" className="exercise-library">
      <header className="exercise-library__header">
        <div>
          <h1 id="exercise-library-heading">Übungsbibliothek</h1>
          <p>Finde Standardübungen oder erstelle eigene Übungen.</p>
        </div>
        <button
          className="button--primary"
          onClick={() => setCreatingExercise(true)}
          type="button"
        >
          Eigene Übung erstellen
        </button>
      </header>

      <div className="exercise-library__filters">
        <label>
          Übungen suchen
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Übungsname"
            type="search"
            value={query}
          />
        </label>
        <label>
          Hauptmuskel
          <select
            onChange={(event) => setPrimaryMuscle(event.target.value)}
            value={primaryMuscle}
          >
            <option value="">Alle Hauptmuskeln</option>
            {primaryMuscles.map((muscle) => (
              <option key={muscle} value={muscle}>
                {muscle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ausrüstung
          <select
            onChange={(event) => setEquipment(event.target.value)}
            value={equipment}
          >
            <option value="">Alle Ausrüstungen</option>
            {equipmentOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            checked={favoritesOnly}
            onChange={(event) => setFavoritesOnly(event.target.checked)}
            type="checkbox"
          />
          Nur Favoriten
        </label>
      </div>

      {visibleExercises.length > 0 ? (
        <div className="exercise-library__grid">
          {visibleExercises.map((exercise) => (
            <ExerciseCard
              exercise={exercise}
              favorite={state.favoriteExerciseIds.includes(exercise.id)}
              imageUrl={imageUrls[exercise.id]}
              key={exercise.id}
              onDetails={setSelectedExercise}
              onToggleFavorite={toggleFavoriteExercise}
            />
          ))}
        </div>
      ) : (
        <p>Keine Übungen gefunden.</p>
      )}

      <ExerciseDetailsDialog
        exercise={selectedExercise}
        imageUrl={selectedExercise ? imageUrls[selectedExercise.id] : undefined}
        onClose={() => setSelectedExercise(undefined)}
        onDelete={
          selectedExercise?.source === 'custom'
            ? (exercise) => {
                setSelectedExercise(undefined)
                setDeletingExercise(exercise)
              }
            : undefined
        }
        onEdit={
          selectedExercise?.source === 'custom'
            ? (exercise) => {
                setSelectedExercise(undefined)
                setEditingExercise(exercise)
              }
            : undefined
        }
        open={Boolean(selectedExercise)}
      />

      {creatingExercise || editingExercise ? (
        <ExerciseEditorDialog
          exercise={editingExercise}
          key={editingExercise?.id ?? 'new-exercise'}
          onClose={() => {
            setCreatingExercise(false)
            setEditingExercise(undefined)
          }}
          open
        />
      ) : null}

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              onClick={() => setDeletingExercise(undefined)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              onClick={() => void confirmDeletion()}
              type="button"
            >
              Löschen
            </button>
          </>
        }
        onClose={() => setDeletingExercise(undefined)}
        open={Boolean(deletingExercise)}
        title="Übung löschen"
      >
        <p>
          Möchtest du „{deletingExercise?.name}“ wirklich löschen?
        </p>
      </ResponsiveDialog>
    </section>
  )
}
