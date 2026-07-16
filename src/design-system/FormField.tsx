import type { ReactNode } from 'react'

export interface FormFieldProps {
  children: ReactNode
  error?: string
  hint?: string
  htmlFor: string
  label: string
}

export function FormField({
  children,
  error,
  hint,
  htmlFor,
  label,
}: FormFieldProps) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="form-field__hint">{hint}</p> : null}
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  )
}
