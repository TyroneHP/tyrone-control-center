export interface TrainingEmptyStateProps {
  action?: {
    label: string
    onClick: () => void
  }
  description: string
  title: string
}

export function TrainingEmptyState({ action, description, title }: TrainingEmptyStateProps) {
  return (
    <section className="training-empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <button onClick={action.onClick} type="button">
          {action.label}
        </button>
      ) : null}
    </section>
  )
}
