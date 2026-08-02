export interface TrainingWizardHeaderProps {
  currentStep: number
  onClose: () => void
  steps: readonly string[]
}

export function TrainingWizardHeader({ currentStep, onClose, steps }: TrainingWizardHeaderProps) {
  return (
    <header className="training-wizard-header">
      <button aria-label="Assistent schließen" onClick={onClose} type="button">
        Schließen
      </button>
      <div>
        <p aria-live="polite" className="training-wizard-header__progress">
          Schritt {currentStep} von {steps.length}
        </p>
        <h1>{steps[currentStep - 1] ?? steps[0]}</h1>
      </div>
    </header>
  )
}
