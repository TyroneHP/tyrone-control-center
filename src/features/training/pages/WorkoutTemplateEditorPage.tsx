import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ResponsiveDialog } from '../../../design-system'
import { ExercisePickerDialog } from '../components/ExercisePickerDialog'
import { SortableExerciseList } from '../components/SortableExerciseList'
import type {
  ExerciseDefinition,
  Weekday,
  WorkoutTemplate,
} from '../model/trainingTypes'
import {
  addTemplateExercise,
  createWorkoutTemplate,
  removeTemplateExercise,
  reorderTemplateExercise,
  updateTemplateExercise,
  type TemplateExerciseChanges,
} from '../model/workoutModel'
import { useTraining } from '../useTraining'

const WEEKDAYS: readonly { label: string; value: Weekday }[] = [
  { label: 'Mo', value: 1 },
  { label: 'Di', value: 2 },
  { label: 'Mi', value: 3 },
  { label: 'Do', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'So', value: 7 },
]

interface TemplateEditorProps {
  initialTemplate?: WorkoutTemplate
}

function cloneTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    weekdays: [...template.weekdays],
    exercises: template.exercises.map((exercise) => ({ ...exercise })),
  }
}

function timestamp() {
  return new Date().toISOString()
}

function TemplateEditor({ initialTemplate }: TemplateEditorProps) {
  const navigate = useNavigate()
  const { catalog, deleteWorkoutTemplate, saveWorkoutTemplate } = useTraining()
  const editing = Boolean(initialTemplate)
  const [template, setTemplate] = useState<WorkoutTemplate>(() =>
    initialTemplate
      ? cloneTemplate(initialTemplate)
      : createWorkoutTemplate({
          name: '',
          weekdays: [],
          timestamp: timestamp(),
        }),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [validationError, setValidationError] = useState<string>()

  const toggleWeekday = (weekday: Weekday) => {
    setTemplate((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((candidate) => candidate !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right),
      updatedAt: timestamp(),
    }))
  }

  const addExercise = (exercise: ExerciseDefinition) => {
    setTemplate((current) =>
      addTemplateExercise(current, exercise.id, timestamp()),
    )
  }

  const updateExercise = (
    exerciseEntryId: string,
    changes: TemplateExerciseChanges,
  ) => {
    setTemplate((current) =>
      updateTemplateExercise(current, exerciseEntryId, changes, timestamp()),
    )
  }

  const moveExercise = (exerciseEntryId: string, toIndex: number) => {
    setTemplate((current) =>
      reorderTemplateExercise(current, exerciseEntryId, toIndex, timestamp()),
    )
  }

  const removeExercise = (exerciseEntryId: string) => {
    setTemplate((current) =>
      removeTemplateExercise(current, exerciseEntryId, timestamp()),
    )
  }

  const submit = () => {
    const name = template.name.trim()
    if (!name) {
      setValidationError('Bitte gib einen Namen für den Trainingsplan ein.')
      return
    }
    if (
      template.exercises.some(
        ({ targetSets, repMin, repMax }) =>
          !Number.isInteger(targetSets) ||
          targetSets < 1 ||
          !Number.isInteger(repMin) ||
          repMin < 1 ||
          !Number.isInteger(repMax) ||
          repMax < repMin,
      )
    ) {
      setValidationError(
        'Zielsätze und Wiederholungen müssen gültige positive Werte sein.',
      )
      return
    }

    saveWorkoutTemplate({
      ...template,
      name,
      weekdays: [...template.weekdays].sort((left, right) => left - right),
      exercises: template.exercises.map((exercise, order) => ({
        ...exercise,
        order,
      })),
      updatedAt: timestamp(),
    })
    navigate('/training')
  }

  const confirmDelete = () => {
    deleteWorkoutTemplate(template.id)
    setDeleteOpen(false)
    navigate('/training')
  }

  return (
    <section
      aria-labelledby="workout-template-heading"
      className="workout-template-editor"
    >
      <header className="workout-template-editor__header">
        <div>
          <h1 id="workout-template-heading">
            {editing ? 'Trainingsplan bearbeiten' : 'Trainingsplan erstellen'}
          </h1>
          <p>Lege Übungen, Zielbereiche und optionale Trainingstage fest.</p>
        </div>
      </header>

      <label className="workout-template-editor__name">
        Name des Trainingsplans
        <input
          onChange={(event) => {
            setValidationError(undefined)
            setTemplate((current) => ({
              ...current,
              name: event.target.value,
              updatedAt: timestamp(),
            }))
          }}
          type="text"
          value={template.name}
        />
      </label>

      <fieldset className="workout-template-editor__weekdays">
        <legend>Trainingstage (optional)</legend>
        {WEEKDAYS.map(({ label, value }) => (
          <label key={value}>
            <input
              checked={template.weekdays.includes(value)}
              onChange={() => toggleWeekday(value)}
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <section aria-labelledby="template-exercises-heading">
        <div className="workout-template-editor__exercise-heading">
          <h2 id="template-exercises-heading">Übungen</h2>
          <button
            className="button--primary"
            onClick={() => setPickerOpen(true)}
            type="button"
          >
            Übung hinzufügen
          </button>
        </div>
        {template.exercises.length > 0 ? (
          <SortableExerciseList
            catalog={catalog}
            exercises={template.exercises}
            onMove={moveExercise}
            onRemove={removeExercise}
            onUpdate={updateExercise}
          />
        ) : (
          <p>Noch keine Übungen hinzugefügt.</p>
        )}
      </section>

      {validationError ? <p role="alert">{validationError}</p> : null}

      <footer className="workout-template-editor__actions">
        <button
          className="button--secondary"
          onClick={() => navigate('/training')}
          type="button"
        >
          Abbrechen
        </button>
        {editing ? (
          <button
            className="button--danger"
            onClick={() => setDeleteOpen(true)}
            type="button"
          >
            Trainingsplan löschen
          </button>
        ) : null}
        <button className="button--primary" onClick={submit} type="button">
          {editing ? 'Änderungen speichern' : 'Trainingsplan speichern'}
        </button>
      </footer>

      <ExercisePickerDialog
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        open={pickerOpen}
      />

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              onClick={() => setDeleteOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              onClick={confirmDelete}
              type="button"
            >
              Endgültig löschen
            </button>
          </>
        }
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        title="Trainingsplan löschen"
      >
        <p>Möchtest du „{template.name}“ wirklich löschen?</p>
      </ResponsiveDialog>
    </section>
  )
}

export function WorkoutTemplateEditorPage() {
  const { templateId } = useParams()
  const { loading, state } = useTraining()

  if (loading) return <p>Trainingsplan wird geladen …</p>

  const existingTemplate = templateId
    ? state.templates.find(({ id }) => id === templateId)
    : undefined

  if (templateId && !existingTemplate) {
    return (
      <section aria-labelledby="workout-template-heading">
        <h1 id="workout-template-heading">Trainingsplan nicht gefunden</h1>
        <p>Der Trainingsplan ist auf diesem Gerät nicht vorhanden.</p>
      </section>
    )
  }

  return (
    <TemplateEditor
      initialTemplate={existingTemplate}
      key={existingTemplate?.id ?? 'new-template'}
    />
  )
}
