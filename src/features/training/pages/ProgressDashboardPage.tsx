import { Card } from '../../../design-system'

export function ProgressDashboardPage() {
  return (
    <section aria-labelledby="progress-heading" className="training-analytics-page">
      <header>
        <p className="eyebrow">Training</p>
        <h1 id="progress-heading">Fortschritt</h1>
        <p>Deine lokalen Trainingsdaten werden für diesen Zeitraum ausgewertet.</p>
      </header>
      <Card>
        <p>Noch keine auswertbaren Trainingsdaten vorhanden.</p>
      </Card>
    </section>
  )
}
