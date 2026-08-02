/* eslint-disable react-refresh/only-export-components -- sortable event normalization is tested separately. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExerciseFilterSheet, emptyExerciseFilters, filterDemoExercises } from '../components/ExerciseFilterSheet'
import { PlanExerciseEditorRow } from '../components/PlanExerciseEditorRow'
import { TrainingChip } from '../components/ui/TrainingChip'
import { TrainingStickyActionBar } from '../components/ui/TrainingStickyActionBar'
import { TrainingWizardHeader } from '../components/ui/TrainingWizardHeader'
import type { TrainingDemoAction, TrainingDemoPlanExercise } from '../demo/trainingDemoTypes'
import { useTrainingDemo } from '../demo/useTrainingDemo'

const steps = ['Grundlagen', 'Übungen', 'Anpassen', 'Vorschau'] as const
const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

export function createSortableMoveAction(
  exercises: readonly TrainingDemoPlanExercise[],
  activeSortableId: string,
  overSortableId: string | null,
): Extract<TrainingDemoAction, { type: 'wizard/reorder-exercise' }> | undefined {
  if (!overSortableId || activeSortableId === overSortableId) return undefined
  const exercise = exercises.find(({ id }) => id === activeSortableId)
  const toIndex = exercises.findIndex(({ id }) => id === overSortableId)
  return exercise && toIndex >= 0
    ? { type: 'wizard/reorder-exercise', exerciseId: exercise.exerciseId, toIndex }
    : undefined
}

export function TrainingPlanWizardPage() {
  const { dispatch, state } = useTrainingDemo()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const initializedEditId = useRef<string | null>(null)
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyExerciseFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor))
  const matchingPlan = editId ? state.plans.find((plan) => plan.id === editId) : undefined

  useEffect(() => {
    if (!editId || initializedEditId.current === editId) return
    initializedEditId.current = editId
    if (!matchingPlan) {
      navigate('/training', { replace: true })
      return
    }
    dispatch({ type: 'wizard/load-plan', planId: editId })
  }, [dispatch, editId, matchingPlan, navigate])

  const visibleExercises = useMemo(
    () => filterDemoExercises(state.exercises, filters, state.favoriteExerciseIds, search),
    [filters, search, state.exercises, state.favoriteExerciseIds],
  )
  const draft = state.wizard.draft
  const basicsValid = draft.name.trim().length > 0 && draft.weekdays.length > 0
  const updateDirty = () => setDirty(true)
  const save = () => {
    if (!basicsValid) return
    dispatch(editId ? { type: 'plan/replace', planId: editId } : { type: 'plan/create' })
    navigate('/training')
  }
  const requestClose = () => {
    if (!dirty || window.confirm('Änderungen verwerfen?')) navigate('/training')
  }
  const next = () => {
    if (step === 1 && !basicsValid) return
    if (step === 4) save()
    else setStep((current) => current + 1)
  }
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const action = createSortableMoveAction(draft.exercises, String(active.id), over ? String(over.id) : null)
    if (action) {
      dispatch(action)
      updateDirty()
    }
  }

  return (
    <main aria-labelledby="training-plan-wizard-heading">
      <span id="training-plan-wizard-heading" className="visually-hidden">Trainingsplan erstellen</span>
      <TrainingWizardHeader currentStep={step} onClose={requestClose} steps={steps} />
      {step === 1 ? <section aria-label="Grundlagen">
        <label>Planname<input aria-label="Planname" onChange={(event) => { dispatch({ type: 'wizard/set-name', name: event.target.value }); updateDirty() }} value={draft.name} /></label>
        <fieldset><legend>Trainingstage</legend>{weekdays.map((weekday, index) => <TrainingChip key={weekday} onClick={() => { dispatch({ type: 'wizard/toggle-weekday', weekday: index + 1 }); updateDirty() }} selected={draft.weekdays.includes(index + 1)}>{weekday}</TrainingChip>)}</fieldset>
        {!basicsValid ? <p role="alert">Bitte Planname und mindestens einen Trainingstag angeben.</p> : null}
        {editId ? <button disabled={!basicsValid} onClick={save} type="button">Plan speichern</button> : null}
      </section> : null}
      {step === 2 ? <section aria-label="Übungen auswählen">
        <label>Übungen suchen<input aria-label="Übungen suchen" onChange={(event) => setSearch(event.target.value)} role="searchbox" type="search" value={search} /></label>
        <button aria-pressed={filters.favoritesOnly} onClick={() => setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))} type="button">Favoriten filtern</button>
        <button onClick={() => setFiltersOpen(true)} type="button">Weitere Filter öffnen</button>
        <ul className="training-list">{visibleExercises.map((exercise) => {
          const selected = state.wizard.selectedExerciseIds.includes(exercise.id)
          return <li key={exercise.id}><button aria-label={`${exercise.name} ${selected ? 'abwählen' : 'auswählen'}`} aria-pressed={selected} onClick={() => { dispatch({ type: 'wizard/toggle-exercise', exerciseId: exercise.id }); updateDirty() }} type="button">{exercise.name}<span>{exercise.muscle} · {exercise.equipment}</span></button></li>
        })}</ul>
        <ExerciseFilterSheet filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} open={filtersOpen} />
      </section> : null}
      {step === 3 ? <section aria-label="Übungen anpassen">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
          <SortableContext items={draft.exercises.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
            <ol>{draft.exercises.map((entry, index) => {
              const exercise = state.exercises.find(({ id }) => id === entry.exerciseId)
              return exercise ? <PlanExerciseEditorRow entry={entry} exercise={exercise} index={index} itemCount={draft.exercises.length} key={entry.id} onMove={(exerciseId, toIndex) => { dispatch({ type: 'wizard/reorder-exercise', exerciseId, toIndex }); updateDirty() }} onRemove={(exerciseId) => { dispatch({ type: 'wizard/toggle-exercise', exerciseId }); updateDirty() }} onUpdate={(exerciseId, changes) => { dispatch({ type: 'wizard/update-exercise', exerciseId, changes }); updateDirty() }} /> : null
            })}</ol>
          </SortableContext>
        </DndContext>
      </section> : null}
      {step === 4 ? <section aria-label="Planvorschau"><h2>{draft.name}</h2><p>{draft.weekdays.map((day) => weekdays[day - 1]).join(', ')}</p><ol>{draft.exercises.map((entry) => <li key={entry.id}>{[state.exercises.find((exercise) => exercise.id === entry.exerciseId)?.name, `${entry.targetSets} × ${entry.repMin}–${entry.repMax}`, entry.startWeightKg === undefined ? null : `${entry.startWeightKg} kg`, entry.grip].filter(Boolean).join(' · ')}</li>)}</ol></section> : null}
      <TrainingStickyActionBar primaryAction={{ disabled: step === 1 && !basicsValid, label: step === 4 ? 'Plan speichern' : `Weiter zu ${steps[step]}`, onClick: next }} secondaryAction={step > 1 ? { label: 'Zurück', onClick: () => setStep((current) => current - 1) } : undefined} />
    </main>
  )
}
