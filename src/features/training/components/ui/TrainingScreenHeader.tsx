import type { ReactNode } from 'react'

export interface TrainingScreenHeaderProps {
  actions?: ReactNode
  backLabel?: string
  eyebrow?: string
  onBack?: () => void
  subtitle?: string
  title: string
}

export function TrainingScreenHeader({
  actions,
  backLabel = 'Zurück',
  eyebrow,
  onBack,
  subtitle,
  title,
}: TrainingScreenHeaderProps) {
  return (
    <header className="training-screen-header">
      <div className="training-screen-header__leading">
        {onBack ? (
          <button className="training-screen-header__back" onClick={onBack} type="button">
            {backLabel}
          </button>
        ) : null}
        <div>
          {eyebrow ? <p className="training-screen-header__eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="training-screen-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="training-screen-header__actions">{actions}</div> : null}
    </header>
  )
}
