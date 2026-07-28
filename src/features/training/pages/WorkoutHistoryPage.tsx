import { Link } from 'react-router-dom'
import { Card } from '../../../design-system'
import { useTraining } from '../useTraining'

const dateTimeFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatCompletedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

export function WorkoutHistoryPage() {
  const { loading, state } = useTraining()
  const completedWorkouts = [...state.completedWorkouts].sort(
    (left, right) =>
      Date.parse(right.completedAt) - Date.parse(left.completedAt),
  )

  if (loading) return <p>Trainingsverlauf wird geladen …</p>

  return (
    <section aria-labelledby="workout-history-heading">
      <header>
        <div>
          <h1 id="workout-history-heading">Trainingsverlauf</h1>
          <p>Deine abgeschlossenen Trainings auf diesem Gerät.</p>
        </div>
        <Link className="button button--secondary" to="/training">
          Zurück zum Training
        </Link>
      </header>

      {completedWorkouts.length === 0 ? (
        <Card>
          <p>Noch keine abgeschlossenen Trainings vorhanden.</p>
        </Card>
      ) : (
        <ol aria-label="Abgeschlossene Trainings">
          {completedWorkouts.map((workout) => (
            <li key={workout.id}>
              <Card>
                <h2>{workout.name}</h2>
                <p>
                  Abgeschlossen am{' '}
                  <time dateTime={workout.completedAt}>
                    {formatCompletedAt(workout.completedAt)}
                  </time>
                </p>
                <p>
                  {workout.exercises.length}{' '}
                  {workout.exercises.length === 1 ? 'Übung' : 'Übungen'}
                </p>
                <Link to={`/training/history/${workout.id}`}>
                  {workout.name} ansehen
                </Link>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
