import { TrainingBottomSheet } from './ui/TrainingBottomSheet'
import type {
  TrainingDemoPlan,
  TrainingDemoSession,
} from '../demo/trainingDemoTypes'

export interface StartTrainingSheetProps {
  activeSession?: TrainingDemoSession
  onClose: () => void
  onContinue: () => void
  onStartFreeSession: () => void
  onStartPlan: (planId: string) => void
  open: boolean
  plans: readonly TrainingDemoPlan[]
  todayPlan?: TrainingDemoPlan
}

export function StartTrainingSheet({
  activeSession,
  onClose,
  onContinue,
  onStartFreeSession,
  onStartPlan,
  open,
  plans,
  todayPlan,
}: StartTrainingSheetProps) {
  const otherPlan = plans.find(({ id }) => id !== todayPlan?.id)

  const choosePlan = (planId: string) => {
    if (activeSession) {
      onContinue()
      return
    }

    onStartPlan(planId)
  }

  const startFreeTraining = () => {
    if (activeSession) {
      onContinue()
      return
    }

    onStartFreeSession()
  }

  return (
    <TrainingBottomSheet onClose={onClose} open={open} title="Training starten">
      {todayPlan ? (
        <button onClick={() => choosePlan(todayPlan.id)} type="button">
          Heutigen Plan
        </button>
      ) : null}
      <button
        disabled={!otherPlan}
        onClick={() => otherPlan && choosePlan(otherPlan.id)}
        type="button"
      >
        Anderen Plan
      </button>
      <button onClick={startFreeTraining} type="button">
        Freies Training
      </button>
      {activeSession ? (
        <p>Ein Training ist bereits aktiv und wird fortgesetzt.</p>
      ) : null}
    </TrainingBottomSheet>
  )
}
