import type { ReactNode } from 'react'

export interface TrainingFabProps {
  children?: ReactNode
  label: string
  onClick: () => void
}

export function TrainingFab({ children = '+', label, onClick }: TrainingFabProps) {
  return (
    <button aria-label={label} className="training-demo__fab" onClick={onClick} type="button">
      {children}
    </button>
  )
}
