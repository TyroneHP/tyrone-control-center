import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      disabled,
      isLoading = false,
      variant = 'primary',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={clsx('button', `button--${variant}`, className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? 'Wird geladen …' : children}
      </button>
    )
  },
)
