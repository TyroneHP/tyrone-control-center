import type { ReactNode } from 'react'

export interface TrainingChipProps {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  selected?: boolean
}

export function TrainingChip({ children, disabled = false, onClick, selected = false }: TrainingChipProps) {
  return (
    <button
      aria-pressed={selected}
      className="training-chip"
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
