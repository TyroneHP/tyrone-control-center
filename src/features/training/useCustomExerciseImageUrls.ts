import { useEffect, useState } from 'react'
import type { ExerciseDefinition } from './model/trainingTypes'
import { useTraining } from './useTraining'

export function useCustomExerciseImageUrls(
  catalog: readonly ExerciseDefinition[],
) {
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
