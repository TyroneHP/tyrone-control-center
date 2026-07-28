import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, ResponsiveDialog } from '../../../design-system'
import type { Weekday, WorkoutTemplate } from '../model/trainingTypes'
import { useTraining } from '../useTraining'

function currentIsoWeekday(date = new Date()): Weekday {
  const day = date.getDay()
  return (day === 0 ? 7 : day) as Weekday
}

interface TemplateCardProps {
  onStart: (template: WorkoutTemplate) => void
  template: WorkoutTemplate
}

function TemplateCard({ onStart, template }: TemplateCardProps) {
  return (
    <Card className="training-template-card">
      <h3>{template.name}</h3>
      <p>
        {template.exercises.length}{' '}
        {template.exercises.length === 1 ? 'Übung' : 'Übungen'}
      </p>
      <div className="training-template-card__actions">
        <button
          aria-label={`Training starten: ${template.name}`}
          className="button--primary"
          onClick={() => onStart(template)}
          type="button"
        >
          Training starten
        </button>
        <Link
          aria-label={`Trainingsplan bearbeiten: ${template.name}`}
          className="button button--secondary"
          to={`/training/templates/${template.id}/edit`}
        >
          Bearbeiten
        </Link>
      </div>
    </Card>
  )
}

export function TrainingHomePage() {
  const navigate = useNavigate()
  const {
    completeWorkout,
    discardWorkout,
    loading,
    startWorkout,
    state,
  } = useTraining()
  const [pendingTemplate, setPendingTemplate] = useState<WorkoutTemplate>()
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)
  const todayTemplates = state.templates.filter(({ weekdays }) =>
    weekdays.includes(currentIsoWeekday()),
  )

  const start = (template: WorkoutTemplate) => {
    if (state.activeWorkout) {
      setPendingTemplate(template)
      return
    }
    startWorkout(template, new Date().toISOString())
    navigate('/training/active')
  }

  const continueActive = () => {
    setPendingTemplate(undefined)
    navigate('/training/active')
  }

  const finishAndStartPending = () => {
    if (!pendingTemplate) return
    const now = new Date().toISOString()
    completeWorkout(now)
    startWorkout(pendingTemplate, now)
    setPendingTemplate(undefined)
    navigate('/training/active')
  }

  const discardAndStartPending = () => {
    if (!pendingTemplate) return
    const template = pendingTemplate
    discardWorkout()
    startWorkout(template, new Date().toISOString())
    setDiscardConfirmationOpen(false)
    setPendingTemplate(undefined)
    navigate('/training/active')
  }

  if (loading) return <p>Training wird geladen …</p>

  return (
    <section aria-labelledby="training-heading" className="training-home">
      <header className="training-home__header">
        <div>
          <h1 id="training-heading">Training</h1>
          <p>Plane dein Training und trainiere vollständig offline.</p>
        </div>
        <Link className="button button--primary" to="/training/templates/new">
          Trainingsplan erstellen
        </Link>
      </header>

      {state.activeWorkout ? (
        <Card className="training-home__active">
          <p>Aktives Training</p>
          <h2>{state.activeWorkout.name}</h2>
          <Link className="button button--primary" to="/training/active">
            Training fortsetzen
          </Link>
        </Card>
      ) : null}

      <section aria-labelledby="today-planned-heading">
        <h2 id="today-planned-heading">Heute geplant</h2>
        {todayTemplates.length > 0 ? (
          <div className="training-home__template-grid">
            {todayTemplates.map((template) => (
              <TemplateCard key={template.id} onStart={start} template={template} />
            ))}
          </div>
        ) : (
          <p>Für heute ist kein Training geplant.</p>
        )}
      </section>

      <section aria-labelledby="training-templates-heading">
        <div className="training-home__section-heading">
          <h2 id="training-templates-heading">Trainingsvorlagen</h2>
        </div>
        {state.templates.length > 0 ? (
          <div className="training-home__template-grid">
            {state.templates.map((template) => (
              <TemplateCard key={template.id} onStart={start} template={template} />
            ))}
          </div>
        ) : (
          <p>Noch keine Trainingsvorlagen vorhanden.</p>
        )}
      </section>

      <nav aria-label="Training Schnellzugriffe" className="training-home__quick-links">
        <Link
          aria-label="Übungsbibliothek öffnen"
          className="button button--secondary"
          to="/training/library"
        >
          Übungsbibliothek
        </Link>
        <Link
          aria-label="Trainingsverlauf öffnen"
          className="button button--secondary"
          to="/training/history"
        >
          Trainingsverlauf
        </Link>
      </nav>

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              onClick={continueActive}
              type="button"
            >
              Fortsetzen
            </button>
            <button
              className="button--secondary"
              onClick={finishAndStartPending}
              type="button"
            >
              Aktives Training abschließen
            </button>
            <button
              className="button--danger"
              onClick={() => setDiscardConfirmationOpen(true)}
              type="button"
            >
              Aktives Training verwerfen
            </button>
          </>
        }
        dismissible={false}
        onClose={() => setPendingTemplate(undefined)}
        open={Boolean(pendingTemplate)}
        title="Aktives Training"
      >
        <p>
          Es läuft bereits „{state.activeWorkout?.name}“. Wie möchtest du
          fortfahren?
        </p>
      </ResponsiveDialog>

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              onClick={() => setDiscardConfirmationOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              onClick={discardAndStartPending}
              type="button"
            >
              Endgültig verwerfen
            </button>
          </>
        }
        onClose={() => setDiscardConfirmationOpen(false)}
        open={discardConfirmationOpen}
        title="Aktives Training wirklich verwerfen?"
      >
        <p>Alle noch nicht abgeschlossenen Eingaben dieses Trainings gehen verloren.</p>
      </ResponsiveDialog>
    </section>
  )
}
