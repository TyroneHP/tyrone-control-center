export interface LoadingIndicatorProps {
  label?: string
}

export function LoadingIndicator({
  label = 'Wird geladen …',
}: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator" role="status">
      <span className="loading-indicator__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
