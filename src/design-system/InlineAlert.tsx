import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export type InlineAlertVariant = 'info' | 'error' | 'success'

export interface InlineAlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: InlineAlertVariant
}

export function InlineAlert({
  className,
  variant = 'info',
  ...props
}: InlineAlertProps) {
  return (
    <div
      className={clsx('inline-alert', `inline-alert--${variant}`, className)}
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
    />
  )
}
