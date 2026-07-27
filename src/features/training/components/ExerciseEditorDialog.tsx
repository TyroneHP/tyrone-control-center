import { type FormEvent, useState } from 'react'
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
  const { saveCustomExercise, saveImage } = useTraining()
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
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(exercise)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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

    setSaving(true)
    try {
      const id = exercise?.id ?? `custom:${crypto.randomUUID()}`
      let customImageId = exercise?.customImageId
      if (image) {
        const processedImage = await normalizeImage(image)
        customImageId ??= id
        await saveImage(customImageId, processedImage)
      }

      const savedExercise: ExerciseDefinition = {
        customImageId,
        description: description.trim(),
        equipment: listValue(equipment),
        gripOptions: listValue(gripOptions),
        id,
        name: trimmedName,
        primaryMuscles: normalizedPrimaryMuscles,
        secondaryMuscles: listValue(secondaryMuscles),
        source: 'custom',
        supportsBodyweightModes,
        unit,
      }
      saveCustomExercise(savedExercise)
      onSaved?.(savedExercise)
      onClose()
    } catch (cause) {
      setErrors({
        image:
          cause instanceof Error
            ? cause.message
            : 'Das Bild konnte nicht verarbeitet werden.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      onClose={onClose}
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
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {errors.image ? <p role="alert">{errors.image}</p> : null}

        <div className="exercise-editor__actions">
          <button className="button--secondary" onClick={onClose} type="button">
            Abbrechen
          </button>
          <button className="button--primary" disabled={saving} type="submit">
            {saving
              ? 'Wird gespeichert …'
              : isEditing
                ? 'Änderungen speichern'
                : 'Übung erstellen'}
          </button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
