import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TrainingDemoExercise, TrainingDemoPlanExercise } from '../demo/trainingDemoTypes'

export interface PlanExerciseEditorRowProps {
  entry: TrainingDemoPlanExercise
  exercise: TrainingDemoExercise
  index: number
  itemCount: number
  onMove: (exerciseId: string, toIndex: number) => void
  onRemove: (exerciseId: string) => void
  onUpdate: (exerciseId: string, changes: Partial<Pick<TrainingDemoPlanExercise, 'targetSets' | 'repMin' | 'repMax' | 'startWeightKg' | 'grip'>>) => void
}

export function PlanExerciseEditorRow({ entry, exercise, index, itemCount, onMove, onRemove, onUpdate }: PlanExerciseEditorRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entry.id })
  const numberChange = (key: 'targetSets' | 'repMin' | 'repMax' | 'startWeightKg') => (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(exercise.id, { [key]: event.target.value === '' ? undefined : Number(event.target.value) })
  }
  return (
    <li data-testid="plan-exercise-row" ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div>
        <button aria-label={`${exercise.name} ziehen und verschieben`} type="button" {...attributes} {...listeners}>Verschieben</button>
        <h2>{exercise.name}</h2>
      </div>
      <div>
        <label>Zielsätze<input aria-label={`Zielsätze für ${exercise.name}`} min="1" onChange={numberChange('targetSets')} type="number" value={entry.targetSets} /></label>
        <label>Wiederholungen von<input aria-label={`Wiederholungen von für ${exercise.name}`} min="1" onChange={numberChange('repMin')} type="number" value={entry.repMin} /></label>
        <label>Wiederholungen bis<input aria-label={`Wiederholungen bis für ${exercise.name}`} min="1" onChange={numberChange('repMax')} type="number" value={entry.repMax} /></label>
        <label>Startgewicht (kg)<input aria-label={`Startgewicht für ${exercise.name}`} min="0" onChange={numberChange('startWeightKg')} placeholder="Optional" type="number" value={entry.startWeightKg ?? ''} /></label>
        {exercise.gripOptions.length ? <label>Griff<input aria-label={`Griff für ${exercise.name}`} list={`griffe-${exercise.id}`} onChange={(event) => onUpdate(exercise.id, { grip: event.target.value })} value={entry.grip ?? ''} /><datalist id={`griffe-${exercise.id}`}>{exercise.gripOptions.map((grip) => <option key={grip} value={grip} />)}</datalist></label> : null}
      </div>
      <div>
        <button aria-label={`${exercise.name} nach oben verschieben`} disabled={index === 0} onClick={() => onMove(exercise.id, index - 1)} type="button">Nach oben</button>
        <button aria-label={`${exercise.name} nach unten verschieben`} disabled={index === itemCount - 1} onClick={() => onMove(exercise.id, index + 1)} type="button">Nach unten</button>
        <button aria-label={`${exercise.name} entfernen`} onClick={() => onRemove(exercise.id)} type="button">Entfernen</button>
      </div>
    </li>
  )
}
