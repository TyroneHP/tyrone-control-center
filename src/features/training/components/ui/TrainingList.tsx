import type { HTMLAttributes, ReactNode } from 'react'

export interface TrainingListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode
}

export function TrainingList({ children, className = '', ...props }: TrainingListProps) {
  return (
    <ul className={`training-list ${className}`.trim()} {...props}>
      {children}
    </ul>
  )
}
