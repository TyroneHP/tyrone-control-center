import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card } from '../../../design-system'
import { CompactExerciseRow } from '../components/ui/CompactExerciseRow'
import { TrainingBottomSheet } from '../components/ui/TrainingBottomSheet'
import { TrainingEmptyState } from '../components/ui/TrainingEmptyState'
import { TrainingList } from '../components/ui/TrainingList'
import { TrainingScreenHeader } from '../components/ui/TrainingScreenHeader'
import { useTrainingDemo } from '../demo/useTrainingDemo'
import type { TrainingDemoPlan } from '../demo/trainingDemoTypes'

const WEEKDAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
]

function formatWeekdays(weekdays: readonly number[]) {
  return weekdays.map((weekday) => WEEKDAY_NAMES[weekday - 1]).join(', ')
}

function planDuration(plan: TrainingDemoPlan) {
  return plan.exercises.length * 15
}

export function TrainingPlanDetailPage() {
  const { dispatch, state } = useTrainingDemo()
  const navigate = useNavigate()
  const { planId } = useParams()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const plan = state.plans.find(({ id }) => id === planId)

  if (!plan) {
    return (
      <main aria-label="Trainingsplan">
        <TrainingEmptyState
          action={{ label: 'Zur Übersicht', onClick: () => navigate('/training') }}
          description="Dieser Trainingsplan ist nicht verfügbar."
          title="Trainingsplan nicht gefunden"
        />
      </main>
    )
  }

  const duplicatePlan = () => {
    dispatch({ type: 'plan/duplicate', planId: plan.id })
    setActionsOpen(false)
  }

  const editPlan = () => {
    setActionsOpen(false)
    navigate(`/training/plans/new?edit=${encodeURIComponent(plan.id)}`)
  }

  const deletePlan = () => {
    dispatch({ type: 'plan/delete', planId: plan.id })
    setDeleteConfirmOpen(false)
    setActionsOpen(false)
    navigate('/training')
  }

  return (
    <main aria-label="Trainingsplan">
      <TrainingScreenHeader
        actions={
          <button
            aria-label="Planaktionen öffnen"
            onClick={() => setActionsOpen(true)}
            type="button"
          >
            Aktionen
          </button>
        }
        onBack={() => navigate('/training')}
        subtitle={`${plan.exercises.length} Übungen · ca. ${planDuration(plan)} Min.`}
        title={plan.name}
      />

      <Card aria-label="Planinformationen">
        <p>Trainingstage: {formatWeekdays(plan.weekdays)}</p>
        <p>{plan.exercises.length} Übungen</p>
        <p>Geschätzte Dauer: ca. {planDuration(plan)} Min.</p>
      </Card>

      <section aria-labelledby="plan-exercises-heading">
        <h2 id="plan-exercises-heading">Übungen</h2>
        <TrainingList aria-label="Übungen im Trainingsplan">
          {plan.exercises.map((planExercise) => {
            const exercise = state.exercises.find(
              ({ id }) => id === planExercise.exerciseId,
            )
            const repetitions = `${planExercise.repMin}–${planExercise.repMax} Wiederholungen`
            return (
              <CompactExerciseRow
                detail={`${planExercise.targetSets} Sätze · ${repetitions}`}
                key={planExercise.id}
                title={exercise?.name ?? 'Unbekannte Übung'}
              />
            )
          })}
        </TrainingList>
      </section>

      <TrainingBottomSheet
        onClose={() => setActionsOpen(false)}
        open={actionsOpen}
        title="Planaktionen"
      >
        <button onClick={editPlan} type="button">
          Plan bearbeiten
        </button>
        <button onClick={duplicatePlan} type="button">
          Plan duplizieren
        </button>
        <Button onClick={() => setDeleteConfirmOpen(true)} type="button" variant="danger">
          Plan löschen
        </Button>
      </TrainingBottomSheet>

      <TrainingBottomSheet
        onClose={() => setDeleteConfirmOpen(false)}
        open={deleteConfirmOpen}
        title="Plan wirklich löschen?"
      >
        <p>Der Plan wird aus dieser Demo entfernt.</p>
        <Button onClick={deletePlan} type="button" variant="danger">
          Endgültig löschen
        </Button>
        <Button onClick={() => setDeleteConfirmOpen(false)} type="button" variant="secondary">
          Abbrechen
        </Button>
      </TrainingBottomSheet>
    </main>
  )
}
