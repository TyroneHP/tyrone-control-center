import type { ReactNode } from 'react'
import { Card } from '../../design-system'
import './auth.css'

export function AuthPageLayout({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) {
  return (
    <main className="auth-page">
      <section className="auth-page__intro" aria-label="Tyrone Control Center">
        <span className="auth-page__mark">TC</span>
        <p className="auth-page__eyebrow">Tyrone Control Center</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <Card className="auth-card">{children}</Card>
    </main>
  )
}
