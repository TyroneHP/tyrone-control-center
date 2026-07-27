import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { ResponsiveDialog } from '../../../design-system'
import type { ExerciseDefinition } from '../model/trainingTypes'
import { useTraining } from '../useTraining'
import { ExerciseCard } from './ExerciseCard'

export interface ExerciseDetailsDialogProps {
  exercise?: ExerciseDefinition
  imageUrl?: string
  onClose: () => void
  onDelete?: (exercise: ExerciseDefinition) => void
  onEdit?: (exercise: ExerciseDefinition) => void
  onSelect?: (exercise: ExerciseDefinition) => void
  open: boolean
}

function ExerciseDetailImage({
  exercise,
  imageUrl,
}: {
  exercise: ExerciseDefinition
  imageUrl?: string
}) {
  const source =
    imageUrl ??
    (exercise.illustrationPath
      ? `${import.meta.env.BASE_URL}${exercise.illustrationPath}`
      : undefined)
  const [unavailable, setUnavailable] = useState(!source)

  if (!source || unavailable) {
    return (
      <div
        aria-label="Keine Abbildung verfügbar"
        className="exercise-detail__fallback"
        role="img"
      >
        <ImageOff aria-hidden="true" size={40} />
      </div>
    )
  }

  return (
    <img
      alt={`Abbildung: ${exercise.name}`}
      className="exercise-detail__image"
      onError={() => setUnavailable(true)}
      src={source}
    />
  )
}

export function ExerciseDetailsDialog({
  exercise,
  imageUrl,
  onClose,
  onDelete,
  onEdit,
  onSelect,
  open,
}: ExerciseDetailsDialogProps) {
  if (!exercise) return null

  const actions = (
    <>
      {onEdit ? (
        <button className="button--secondary" onClick={() => onEdit(exercise)} type="button">
          Bearbeiten
        </button>
      ) : null}
      {onDelete ? (
        <button className="button--danger" onClick={() => onDelete(exercise)} type="button">
          Löschen
        </button>
      ) : null}
      {onSelect ? (
        <button
          className="button--primary"
          onClick={() => onSelect(exercise)}
          type="button"
        >
          Zum Training hinzufügen
        </button>
      ) : null}
    </>
  )

  return (
    <ResponsiveDialog actions={actions} onClose={onClose} open={open} title={exercise.name}>
      <section className="exercise-detail">
        <ExerciseDetailImage exercise={exercise} imageUrl={imageUrl} />
        <dl>
          <div>
            <dt>Hauptmuskeln</dt>
            <dd>{exercise.primaryMuscles.join(', ')}</dd>
          </div>
          <div>
            <dt>Nebenmuskeln</dt>
            <dd>{exercise.secondaryMuscles.join(', ') || 'Keine Angabe'}</dd>
          </div>
          <div>
            <dt>Ausrüstung</dt>
            <dd>{exercise.equipment.join(', ') || 'Keine Angabe'}</dd>
          </div>
          <div>
            <dt>Beschreibung</dt>
            <dd>{exercise.description || 'Keine Beschreibung vorhanden.'}</dd>
          </div>
          {exercise.gripOptions.length > 0 ? (
            <div>
              <dt>Griffoptionen</dt>
              <dd>{exercise.gripOptions.join(', ')}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </ResponsiveDialog>
  )
}

export interface ExercisePickerDialogProps {
  onClose: () => void
  onSelect: (exercise: ExerciseDefinition) => void
  open: boolean
}

export function ExercisePickerDialog({
  onClose,
  onSelect,
  open,
}: ExercisePickerDialogProps) {
  const { catalog, state } = useTraining()
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition>()

  return (
    <>
      <ResponsiveDialog onClose={onClose} open={open} title="Übung auswählen">
        <div className="exercise-picker__list">
          {catalog.map((exercise) => (
            <ExerciseCard
              exercise={exercise}
              favorite={state.favoriteExerciseIds.includes(exercise.id)}
              key={exercise.id}
              onDetails={setSelectedExercise}
            />
          ))}
        </div>
      </ResponsiveDialog>
      <ExerciseDetailsDialog
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(undefined)}
        onSelect={(exercise) => {
          onSelect(exercise)
          setSelectedExercise(undefined)
          onClose()
        }}
        open={Boolean(selectedExercise)}
      />
    </>
  )
}
