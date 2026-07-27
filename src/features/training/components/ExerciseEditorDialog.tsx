import { type FormEvent, useRef, useState } from 'react'
import { ResponsiveDialog } from '../../../design-system'
import { normalizeExerciseImage } from '../imageProcessing'
import type { ExerciseDefinition, ExerciseUnit } from '../model/trainingTypes'
import { useTraining } from '../useTraining'

export interface ExerciseEditorDialogProps {
  exercise?: ExerciseDefinition
  normalizeImage?: (source: Blob) => Promise<Blob>
  onClose: () => void
  onSaved?: (exercise: ExerciseDefinition) => void
  open: boolean
}

interface FieldErrors {
  image?: string
  name?: string
  primaryMuscles?: string
}

interface PendingImageCleanup {
  imageId: string
  savedExercise?: ExerciseDefinition
  retryError?: string
}

function listValue(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function initialList(values: readonly string[] | undefined) {
  return values?.join(', ') ?? ''
}

export function ExerciseEditorDialog({
  exercise,
  normalizeImage = normalizeExerciseImage,
  onClose,
  onSaved,
  open,
}: ExerciseEditorDialogProps) {
  const { deleteImage, saveCustomExercise, saveImage } = useTraining()
  const [exerciseId] = useState(
    () => exercise?.id ?? `custom:${crypto.randomUUID()}`,
  )
  const [name, setName] = useState(() => exercise?.name ?? '')
  const [primaryMuscles, setPrimaryMuscles] = useState(() =>
    initialList(exercise?.primaryMuscles),
  )
  const [secondaryMuscles, setSecondaryMuscles] = useState(() =>
    initialList(exercise?.secondaryMuscles),
  )
  const [equipment, setEquipment] = useState(() =>
    initialList(exercise?.equipment),
  )
  const [description, setDescription] = useState(() => exercise?.description ?? '')
  const [gripOptions, setGripOptions] = useState(() =>
    initialList(exercise?.gripOptions),
  )
  const [unit, setUnit] = useState<ExerciseUnit>(
    () => exercise?.unit ?? 'kg-reps',
  )
  const [supportsBodyweightModes, setSupportsBodyweightModes] = useState(
    () => exercise?.supportsBodyweightModes ?? false,
  )
  const [image, setImage] = useState<File | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [pendingImageCleanup, setPendingImageCleanup] =
    useState<PendingImageCleanup>()
  const savingRef = useRef(false)
  const isEditing = Boolean(exercise)

  const errorMessage = (cause: unknown, fallback: string) =>
    cause instanceof Error ? cause.message : fallback

  const closeIfIdle = () => {
    if (!savingRef.current) onClose()
  }

  const retryImageCleanup = async () => {
    if (!pendingImageCleanup || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      await deleteImage(pendingImageCleanup.imageId)
      const { retryError, savedExercise } = pendingImageCleanup
      setPendingImageCleanup(undefined)
      if (savedExercise) {
        onSaved?.(savedExercise)
        onClose()
      } else {
        setErrors(retryError ? { image: retryError } : {})
      }
    } catch (cause) {
      setErrors({
        image: errorMessage(
          cause,
          'Das gespeicherte Bild konnte nicht gelöscht werden.',
        ),
      })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || pendingImageCleanup) return
    const trimmedName = name.trim()
    const normalizedPrimaryMuscles = listValue(primaryMuscles)
    const nextErrors: FieldErrors = {}
    if (!trimmedName) nextErrors.name = 'Name ist erforderlich.'
    if (normalizedPrimaryMuscles.length === 0) {
      nextErrors.primaryMuscles = 'Mindestens ein Hauptmuskel ist erforderlich.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    savingRef.current = true
    setSaving(true)
    setErrors({})
    let newImageId: string | undefined
    let newImageStored = false
    let metadataSaved = false
    try {
      let customImageId = removeExistingImage
        ? undefined
        : exercise?.customImageId
      if (image) {
        const processedImage = await normalizeImage(image)
        newImageId = `custom:image:${crypto.randomUUID()}`
        await saveImage(newImageId, processedImage)
        newImageStored = true
        customImageId = newImageId
      }

      const savedExercise: ExerciseDefinition = {
        customImageId,
        description: description.trim(),
        equipment: listValue(equipment),
        gripOptions: listValue(gripOptions),
        id: exerciseId,
        name: trimmedName,
        primaryMuscles: normalizedPrimaryMuscles,
        secondaryMuscles: listValue(secondaryMuscles),
        source: 'custom',
        supportsBodyweightModes,
        unit,
      }
      await saveCustomExercise(savedExercise)
      metadataSaved = true

      const previousImageId = exercise?.customImageId
      if (previousImageId && previousImageId !== customImageId) {
        try {
          await deleteImage(previousImageId)
        } catch (cause) {
          setPendingImageCleanup({
            imageId: previousImageId,
            savedExercise,
          })
          setErrors({
            image: errorMessage(
              cause,
              'Das bisherige Bild konnte nicht gelöscht werden.',
            ),
          })
          return
        }
      }

      onSaved?.(savedExercise)
      onClose()
    } catch (cause) {
      const originalError = errorMessage(
        cause,
        'Die Übung konnte nicht gespeichert werden.',
      )
      if (newImageId && newImageStored && !metadataSaved) {
        try {
          await deleteImage(newImageId)
        } catch (cleanupCause) {
          setPendingImageCleanup({
            imageId: newImageId,
            retryError: originalError,
          })
          setErrors({
            image: errorMessage(
              cleanupCause,
              'Das neue Bild konnte nicht zurückgerollt werden.',
            ),
          })
          return
        }
      }
      setErrors({
        image: originalError,
      })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      dismissible={!saving}
      onClose={closeIfIdle}
      open={open}
      title={isEditing ? 'Übung bearbeiten' : 'Eigene Übung erstellen'}
    >
      <form className="exercise-editor" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </label>
        {errors.name ? <p role="alert">{errors.name}</p> : null}

        <label>
          Hauptmuskeln
          <input
            aria-invalid={Boolean(errors.primaryMuscles)}
            onChange={(event) => setPrimaryMuscles(event.target.value)}
            type="text"
            value={primaryMuscles}
          />
        </label>
        {errors.primaryMuscles ? <p role="alert">{errors.primaryMuscles}</p> : null}

        <label>
          Nebenmuskeln
          <input
            onChange={(event) => setSecondaryMuscles(event.target.value)}
            type="text"
            value={secondaryMuscles}
          />
        </label>
        <label>
          Ausrüstung
          <input
            onChange={(event) => setEquipment(event.target.value)}
            type="text"
            value={equipment}
          />
        </label>
        <label>
          Beschreibung
          <textarea
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
        <label>
          Griffoptionen
          <input
            onChange={(event) => setGripOptions(event.target.value)}
            type="text"
            value={gripOptions}
          />
        </label>
        <label>
          Einheit
          <select
            onChange={(event) => setUnit(event.target.value as ExerciseUnit)}
            value={unit}
          >
            <option value="kg-reps">Kilogramm und Wiederholungen</option>
            <option value="reps">Wiederholungen</option>
            <option value="seconds">Sekunden</option>
          </select>
        </label>
        <label>
          <input
            checked={supportsBodyweightModes}
            onChange={(event) => setSupportsBodyweightModes(event.target.checked)}
            type="checkbox"
          />
          Eigengewicht-Modi unterstützen
        </label>
        <label>
          Bild (optional)
          <input
            accept="image/*"
            onChange={(event) => {
              const nextImage = event.target.files?.[0] ?? null
              setImage(nextImage)
              if (nextImage) setRemoveExistingImage(false)
            }}
            type="file"
          />
        </label>
        {exercise?.customImageId ? (
          <label>
            <input
              checked={removeExistingImage}
              onChange={(event) => {
                setRemoveExistingImage(event.target.checked)
                if (event.target.checked) setImage(null)
              }}
              type="checkbox"
            />
            Vorhandenes Bild entfernen
          </label>
        ) : null}
        {errors.image ? <p role="alert">{errors.image}</p> : null}

        <div className="exercise-editor__actions">
          <button
            className="button--secondary"
            disabled={saving}
            onClick={closeIfIdle}
            type="button"
          >
            Abbrechen
          </button>
          {pendingImageCleanup ? (
            <button
              className="button--primary"
              disabled={saving}
              onClick={() => void retryImageCleanup()}
              type="button"
            >
              {saving
                ? 'Bildlöschung wird wiederholt …'
                : 'Bildlöschung erneut versuchen'}
            </button>
          ) : (
            <button className="button--primary" disabled={saving} type="submit">
              {saving
                ? 'Wird gespeichert …'
                : isEditing
                  ? 'Änderungen speichern'
                  : 'Übung erstellen'}
            </button>
          )}
        </div>
      </form>
    </ResponsiveDialog>
  )
}
