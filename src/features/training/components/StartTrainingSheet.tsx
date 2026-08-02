import { TrainingBottomSheet } from './ui/TrainingBottomSheet'
import type {
  TrainingDemoPlan,
  TrainingDemoSession,
} from '../demo/trainingDemoTypes'

export interface StartTrainingSheetProps {
  activeSession?: TrainingDemoSession
  onClose: () => void
  onContinue: () => void
  onStartPlan: (planId: string) => void
  open: boolean
  plans: readonly TrainingDemoPlan[]
  todayPlan?: TrainingDemoPlan
}

export function StartTrainingSheet({
  activeSession,
  onClose,
  onContinue,
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
      <button disabled type="button">
        Freies Training
      </button>
      {activeSession ? (
        <p>Ein Training ist bereits aktiv und wird fortgesetzt.</p>
      ) : null}
    </TrainingBottomSheet>
  )
}
