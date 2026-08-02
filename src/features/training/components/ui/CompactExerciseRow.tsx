import type { ReactNode } from 'react'

export interface CompactExerciseRowProps {
  detail?: string
  illustration?: ReactNode
  onClick?: () => void
  title: string
  trailing?: ReactNode
}

export function CompactExerciseRow({
  detail,
  illustration,
  onClick,
  title,
  trailing,
}: CompactExerciseRowProps) {
  const content = (
    <>
      {illustration ? <span className="compact-exercise-row__illustration">{illustration}</span> : null}
      <span className="compact-exercise-row__copy">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
      {trailing ? <span className="compact-exercise-row__trailing">{trailing}</span> : null}
    </>
  )

  return (
    <li className="compact-exercise-row">
      {onClick ? (
        <button aria-label={`Übung öffnen: ${title}`} onClick={onClick} type="button">
          {content}
        </button>
      ) : (
        <div>{content}</div>
      )}
    </li>
  )
}
