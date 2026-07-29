import { Heart, Info, ImageOff } from 'lucide-react'
import { useId, useState } from 'react'
import type { ExerciseDefinition } from '../model/trainingTypes'

export interface ExerciseCardProps {
  exercise: ExerciseDefinition
  favorite?: boolean
  imageUrl?: string
  onDetails: (exercise: ExerciseDefinition) => void
  onToggleFavorite?: (exerciseId: string) => void
}

function ExerciseImage({
  exercise,
  source,
}: {
  exercise: ExerciseDefinition
  source?: string
}) {
  const [unavailable, setUnavailable] = useState(!source)

  if (unavailable || !source) {
    return (
      <div
        aria-label="Keine Abbildung verfügbar"
        className="exercise-card__fallback"
        role="img"
      >
        <ImageOff aria-hidden="true" size={28} />
      </div>
    )
  }

  return (
    <img
      alt={`Abbildung: ${exercise.name}`}
      className="exercise-card__image"
      loading="lazy"
      onError={() => setUnavailable(true)}
      src={source}
    />
  )
}

export function ExerciseCard({
  exercise,
  favorite = false,
  imageUrl,
  onDetails,
  onToggleFavorite,
}: ExerciseCardProps) {
  const titleId = useId()
  const source =
    imageUrl ??
    (exercise.illustrationPath
      ? `${import.meta.env.BASE_URL}${exercise.illustrationPath}`
      : undefined)

  return (
    <article aria-labelledby={titleId} className="card exercise-card">
      <ExerciseImage
        exercise={exercise}
        key={source ?? 'fallback'}
        source={source}
      />
      <div className="exercise-card__content">
        <h2 id={titleId}>{exercise.name}</h2>
        <p>Hauptmuskeln: {exercise.primaryMuscles.join(', ')}</p>
        <p>Ausrüstung: {exercise.equipment.join(', ') || 'Keine Angabe'}</p>
        <div className="exercise-card__actions">
          <button
            aria-label={`Details zu ${exercise.name}`}
            className="button--secondary"
            onClick={() => onDetails(exercise)}
            type="button"
          >
            <Info aria-hidden="true" size={18} />
            Details
          </button>
          {onToggleFavorite ? (
            <button
              aria-label={`${
                favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'
              }: ${exercise.name}`}
              aria-pressed={favorite}
              className="button--ghost"
              onClick={() => onToggleFavorite(exercise.id)}
              type="button"
            >
              <Heart aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} size={18} />
              <span>{favorite ? 'Favorit' : 'Favorisieren'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
