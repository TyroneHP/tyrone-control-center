import { Card } from '../design-system'
import './routes.css'

export function PlaceholderPage({
  description = 'Dieses Modul wird in einem späteren Meilenstein aktiviert.',
  title,
}: {
  description?: string
  title: string
}) {
  return (
    <section className="placeholder-page">
      <header className="placeholder-page__header">
        <p>Foundation</p>
        <h1>{title}</h1>
      </header>
      <Card>
        <p className="placeholder-page__status">Bereich vorbereitet</p>
        <p>{description}</p>
      </Card>
    </section>
  )
}
