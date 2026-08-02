export interface TrainingAction {
  disabled?: boolean
  label: string
  onClick: () => void
}

export interface TrainingStickyActionBarProps {
  primaryAction: TrainingAction
  secondaryAction?: TrainingAction
}

export function TrainingStickyActionBar({
  primaryAction,
  secondaryAction,
}: TrainingStickyActionBarProps) {
  return (
    <div className="training-demo__sticky-action">
      {secondaryAction ? (
        <button disabled={secondaryAction.disabled} onClick={secondaryAction.onClick} type="button">
          {secondaryAction.label}
        </button>
      ) : null}
      <button
        className="training-sticky-action__primary"
        disabled={primaryAction.disabled}
        onClick={primaryAction.onClick}
        type="button"
      >
        {primaryAction.label}
      </button>
    </div>
  )
}
