import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type {
  ExerciseDefinition,
  WorkoutTemplateExercise,
} from '../model/trainingTypes'
import type { TemplateExerciseChanges } from '../model/workoutModel'

export interface SortableExerciseListProps {
  catalog: readonly ExerciseDefinition[]
  exercises: readonly WorkoutTemplateExercise[]
  onMove: (exerciseEntryId: string, toIndex: number) => void
  onRemove: (exerciseEntryId: string) => void
  onUpdate: (
    exerciseEntryId: string,
    changes: TemplateExerciseChanges,
  ) => void
}

interface SortableExerciseRowProps {
  exercise: ExerciseDefinition | undefined
  entry: WorkoutTemplateExercise
  index: number
  itemCount: number
  onMove: SortableExerciseListProps['onMove']
  onRemove: SortableExerciseListProps['onRemove']
  onUpdate: SortableExerciseListProps['onUpdate']
}

function SortableExerciseRow({
  entry,
  exercise,
  index,
  itemCount,
  onMove,
  onRemove,
  onUpdate,
}: SortableExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })
  const name = exercise?.name ?? 'Unbekannte Übung'

  return (
    <li
      className={`template-exercise${isDragging ? ' template-exercise--dragging' : ''}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <header className="template-exercise__header">
        <button
          aria-label={`Übung verschieben: ${name}`}
          className="button--ghost template-exercise__drag-handle"
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={20} />
        </button>
        <h2>{name}</h2>
      </header>

      <div className="template-exercise__targets">
        <label>
          Zielsätze
          <input
            aria-label={`Zielsätze für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onUpdate(entry.id, {
                targetSets: event.target.value === '' ? 0 : Number(event.target.value),
              })
            }
            type="number"
            value={entry.targetSets || ''}
          />
        </label>
        <label>
          Wiederholungen von
          <input
            aria-label={`Minimale Wiederholungen für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onUpdate(entry.id, {
                repMin: event.target.value === '' ? 0 : Number(event.target.value),
              })
            }
            type="number"
            value={entry.repMin || ''}
          />
        </label>
        <label>
          Wiederholungen bis
          <input
            aria-label={`Maximale Wiederholungen für ${name}`}
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onUpdate(entry.id, {
                repMax: event.target.value === '' ? 0 : Number(event.target.value),
              })
            }
            type="number"
            value={entry.repMax || ''}
          />
        </label>
      </div>

      <div className="template-exercise__actions">
        <button
          aria-label="Übung nach oben"
          className="button--secondary"
          disabled={index === 0}
          onClick={() => onMove(entry.id, index - 1)}
          type="button"
        >
          Nach oben
        </button>
        <button
          aria-label="Übung nach unten"
          className="button--secondary"
          disabled={index === itemCount - 1}
          onClick={() => onMove(entry.id, index + 1)}
          type="button"
        >
          Nach unten
        </button>
        <button
          aria-label={`Übung entfernen: ${name}`}
          className="button--danger"
          onClick={() => onRemove(entry.id)}
          type="button"
        >
          Entfernen
        </button>
      </div>
    </li>
  )
}

export function SortableExerciseList({
  catalog,
  exercises,
  onMove,
  onRemove,
  onUpdate,
}: SortableExerciseListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = exercises.findIndex(({ id }) => id === over.id)
    if (toIndex >= 0) onMove(String(active.id), toIndex)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={exercises.map(({ id }) => id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="template-exercise-list">
          {exercises.map((entry, index) => (
            <SortableExerciseRow
              entry={entry}
              exercise={catalog.find(({ id }) => id === entry.exerciseId)}
              index={index}
              itemCount={exercises.length}
              key={entry.id}
              onMove={onMove}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
