import { forwardRef, type HTMLAttributes } from 'react'
import clsx from 'clsx'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return <div ref={ref} className={clsx('card', className)} {...props} />
  },
)
