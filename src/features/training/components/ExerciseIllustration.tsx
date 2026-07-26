import type { ExerciseDefinition } from '../model/trainingTypes'

interface Props {
  exercise: ExerciseDefinition
  decorative?: boolean
}

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
