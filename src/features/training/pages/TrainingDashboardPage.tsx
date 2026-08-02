import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../design-system'
import { StartTrainingSheet } from '../components/StartTrainingSheet'
import { TrainingFab } from '../components/ui/TrainingFab'
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

function currentIsoWeekday() {
  return new Date().getDay() || 7
}

function planDetail(plan: TrainingDemoPlan) {
  const minutes = plan.exercises.length * 15
  return `${plan.exercises.length} Übungen · ca. ${minutes} Min.`
}

export function TrainingDashboardPage() {
  const { dispatch, state } = useTrainingDemo()
  const navigate = useNavigate()
  const [startSheetOpen, setStartSheetOpen] = useState(false)
  const [weekday] = useState(currentIsoWeekday)
  const todayPlan = state.plans.find((plan) => plan.weekdays.includes(weekday))
  const additionalPlans = state.plans.filter((plan) => plan.id !== todayPlan?.id)

  const continueTraining = () => navigate('/training/active')
  const startPlan = (planId: string) => {
    if (state.activeSession) {
      continueTraining()
      return
    }

    dispatch({ type: 'session/start', planId })
    setStartSheetOpen(false)
    navigate('/training/active')
  }

  return (
    <main aria-label="Training">
      <TrainingScreenHeader
        subtitle="Dein Training auf einen Blick."
        title="Training"
      />

      {state.activeSession ? (
        <section aria-label="Aktives Training">
          <Card>
            <p>Aktives Training</p>
            <h2>{state.activeSession.name}</h2>
            <button onClick={continueTraining} type="button">
              Training fortsetzen
            </button>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="today-training-heading">
        <h2 id="today-training-heading">Heute · {WEEKDAY_NAMES[weekday - 1]}</h2>
        {todayPlan ? (
          <Card>
            <p>Geplant</p>
            <h3>{todayPlan.name}</h3>
            <p>{planDetail(todayPlan)}</p>
            <button onClick={() => setStartSheetOpen(true)} type="button">
              Training starten
            </button>
          </Card>
        ) : (
          <Card>
            <p>Für heute ist kein Plan vorgesehen.</p>
            <button onClick={() => setStartSheetOpen(true)} type="button">
              Training starten
            </button>
          </Card>
        )}
      </section>

      <section aria-labelledby="other-plans-heading">
        <h2 id="other-plans-heading">Weitere Trainingspläne</h2>
        <TrainingList aria-label="Weitere Trainingspläne">
          {additionalPlans.map((plan) => (
            <li className="compact-exercise-row" key={plan.id}>
              <button
                aria-label={`Plan öffnen: ${plan.name}`}
                onClick={() => navigate(`/training/plans/${plan.id}`)}
                type="button"
              >
                <span className="compact-exercise-row__copy">
                  <strong>{plan.name}</strong>
                  <span>{planDetail(plan)}</span>
                </span>
              </button>
            </li>
          ))}
        </TrainingList>
      </section>

      <TrainingList aria-label="Schnellzugriffe">
        <li className="compact-exercise-row">
          <button onClick={() => setStartSheetOpen(true)} type="button">
            <span className="compact-exercise-row__copy">
              <strong>Freies Training</strong>
              <span>Starte ohne Tagesplan.</span>
            </span>
          </button>
        </li>
        <li className="compact-exercise-row">
          <button onClick={() => navigate('/training/library')} type="button">
            <span className="compact-exercise-row__copy">
              <strong>Übungsbibliothek</strong>
              <span>Übungen ansehen.</span>
            </span>
          </button>
        </li>
      </TrainingList>

      <TrainingFab
        label="Schnellstart Training"
        onClick={() => setStartSheetOpen(true)}
      />
      <StartTrainingSheet
        activeSession={state.activeSession}
        onClose={() => setStartSheetOpen(false)}
        onContinue={continueTraining}
        onStartPlan={startPlan}
        open={startSheetOpen}
        plans={state.plans}
        todayPlan={todayPlan}
      />
    </main>
  )
}
